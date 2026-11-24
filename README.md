<div align="center">
<img src="assets/logo.png?v=1" width="280" alt="tiny-stack-vm-01 logo">

**A tiny stack VM in TypeScript — full ISA with traps, fuzz-verified against the reference.**

![TypeScript](https://img.shields.io/badge/language-TypeScript-0A1931?style=for-the-badge&labelColor=FF7A00) ![License MIT](https://img.shields.io/badge/license-MIT-0A1931?style=for-the-badge&labelColor=FF7A00) ![By Kontenlaris Studio](https://img.shields.io/badge/by-Kontenlaris_Studio-0A1931?style=for-the-badge&labelColor=FF7A00)
</div>

# Tiny Stack VM

[![Competition](https://make.fun/badge/tiny-stack-vm-01-run-20261122.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![Rank](https://make.fun/badge/tiny-stack-vm-01-run-20261122/kontenlaris-studio/tiny-stack-vm-01/rank.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)
[![Reward](https://make.fun/badge/tiny-stack-vm-01-run-20261122/kontenlaris-studio/tiny-stack-vm-01/reward.svg)](https://make.fun/bounty/tiny-stack-vm-01-run-20261122)

An exact interpreter for make.fun's tiny stack ISA v1 in one dependency-free
`main.ts`: wrapping 32-bit arithmetic, signed and unsigned division
kept apart, every trap's own exit code, all limits in the ISA's order.
