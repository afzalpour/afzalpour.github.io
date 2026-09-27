//go:build !windows

package main

import (
	"os/exec"
	"runtime"
)

func configureChildProcess(cmd *exec.Cmd) {}
func setBelowNormal(pid int) error        { return nil }
func killImage(name string)               {}
func openURL(url string) error {
	var cmd *exec.Cmd
	if runtime.GOOS == "darwin" {
		cmd = exec.Command("open", url)
	} else {
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Start()
}
