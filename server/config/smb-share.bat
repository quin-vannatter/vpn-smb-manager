net use "\\10.8.0.1\share\users\<username>" /delete 
cmdkey /add:10.8.0.1 /usr:"<username>" /pass:"<password>"
net use * "\\10.8.0.1\share\users\<username>"

%SystemRoot%\explorer.exe "\\10.8.0.1\share\users\<username>"
