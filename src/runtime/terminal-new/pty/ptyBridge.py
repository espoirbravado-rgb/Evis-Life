import sys
import os
import pty
import fcntl
import termios
import struct
import select
import argparse
import signal

def set_pty_size(master_fd, cols, rows):
    try:
        winsize = struct.pack('HHHH', int(rows), int(cols), 0, 0)
        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
    except Exception:
        pass

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cols', type=int, default=80)
    parser.add_argument('--rows', type=int, default=24)
    parser.add_argument('--cwd', type=str, default=os.getcwd())
    parser.add_argument('--cmd', type=str, required=True)
    args = parser.parse_args()

    master, slave = pty.openpty()
    set_pty_size(master, args.cols, args.rows)

    pid = os.fork()
    if pid == 0:
        os.close(master)
        os.setsid()
        try:
            fcntl.ioctl(slave, termios.TIOCSCTTY, 0)
        except Exception:
            pass
        os.dup2(slave, 0)
        os.dup2(slave, 1)
        os.dup2(slave, 2)
        os.close(slave)

        try:
            os.chdir(args.cwd)
        except Exception:
            pass

        # Execute using default shell
        shell = os.environ.get('SHELL', '/bin/bash')
        os.execlp(shell, shell, '-c', args.cmd)
        sys.exit(127)

    os.close(slave)

    # Inform Node of the child PID via stderr or control
    sys.stderr.write(f"PID:{pid}\n")
    sys.stderr.flush()

    # Check if fd 3 is open for control (resize commands)
    has_control_fd = False
    try:
        fcntl.fcntl(3, fcntl.F_GETFD)
        has_control_fd = True
    except Exception:
        has_control_fd = False

    read_list = [master, 0]
    if has_control_fd:
        read_list.append(3)

    child_exited = False
    exit_code = 0

    while True:
        try:
            rlist, _, _ = select.select(read_list, [], [], 0.05)
        except (select.error, InterruptedError):
            continue

        for fd in rlist:
            if fd == master:
                try:
                    data = os.read(master, 4096)
                    if not data:
                        read_list.remove(master)
                    else:
                        sys.stdout.buffer.write(data)
                        sys.stdout.buffer.flush()
                except OSError:
                    if master in read_list:
                        read_list.remove(master)

            elif fd == 0:
                try:
                    data = os.read(0, 4096)
                    if not data:
                        read_list.remove(0)
                    else:
                        os.write(master, data)
                except OSError:
                    if 0 in read_list:
                        read_list.remove(0)

            elif fd == 3:
                try:
                    line = os.read(3, 256).decode()
                    if line:
                        parts = line.strip().split(',')
                        if len(parts) >= 2:
                            set_pty_size(master, parts[0], parts[1])
                except Exception:
                    pass

        # Check child status
        wpid, status = os.waitpid(pid, os.WNOHANG)
        if wpid == pid:
            child_exited = True
            exit_code = os.waitstatus_to_exitcode(status)
            break

    # Flush remaining data from master
    try:
        while True:
            r, _, _ = select.select([master], [], [], 0.02)
            if not r:
                break
            data = os.read(master, 4096)
            if not data:
                break
            sys.stdout.buffer.write(data)
            sys.stdout.buffer.flush()
    except Exception:
        pass

    try:
        os.close(master)
    except Exception:
        pass

    sys.exit(exit_code)

if __name__ == '__main__':
    main()
