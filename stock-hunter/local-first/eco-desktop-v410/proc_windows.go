//go:build windows

package main

import (
	"fmt"
	"os/exec"
	"syscall"
	"unsafe"
)

const (
	createNoWindow                 = 0x08000000
	belowNormalPriority            = 0x00004000
	processSetInformation          = 0x0200
	processQueryLimitedInformation = 0x1000
)

func configureChildProcess(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: createNoWindow}
}

func setBelowNormal(pid int) error {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	openProcess := kernel32.NewProc("OpenProcess")
	setPriority := kernel32.NewProc("SetPriorityClass")
	closeHandle := kernel32.NewProc("CloseHandle")
	h, _, e := openProcess.Call(processSetInformation|processQueryLimitedInformation, 0, uintptr(uint32(pid)))
	if h == 0 {
		return fmt.Errorf("OpenProcess: %v", e)
	}
	defer closeHandle.Call(h)
	ok, _, e := setPriority.Call(h, belowNormalPriority)
	if ok == 0 {
		return fmt.Errorf("SetPriorityClass: %v", e)
	}
	return nil
}

func killImage(name string) {
	cmd := exec.Command("taskkill", "/F", "/IM", name)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: createNoWindow}
	_ = cmd.Run()
}

func openURL(url string) error {
	cmd := exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: createNoWindow}
	return cmd.Start()
}

var _ = unsafe.Pointer(nil)
