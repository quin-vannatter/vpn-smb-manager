#!/bin/bash

sudo cat /var/log/openvpn/openvpn.log | grep -aE "(Peer Connection Initiated|client-instance exiting|Initialization Sequence Completed|IV_HWADDR)"
