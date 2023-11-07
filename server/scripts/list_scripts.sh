#!/bin/bash

if [ -d "$1" ]; then
    ls "$1/"* | grep ".js"
fi