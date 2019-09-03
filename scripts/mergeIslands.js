#!/usr/bin/env node
const fs = require(fs)

const baseIslands = fs.readdirSync('./out/islands')

console.log(baseIslands)