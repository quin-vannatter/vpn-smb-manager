#!/bin/bash

TOTAL_BLOCKS=0
USED_BLOCKS=0
for directory in /share/drive*/; do
    TOTAL_BLOCKS=$(($TOTAL_BLOCKS + $(df $directory | tail -1 | awk '{print $2}')))
    USED_BLOCKS=$(($USED_BLOCKS + $(df $directory | tail -1 | awk '{print $4}')))
done

echo $TOTAL_BLOCKS $USED_BLOCKS