#!/bin/bash

sudo cat /var/log/openvpn/openvpn.log | grep -E "(Peer Connection Initiated|client-instance exiting|Initialization Sequence Completed)"