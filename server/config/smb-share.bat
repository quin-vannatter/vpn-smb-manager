net use * "\\10.8.0.1\share\users\<username>" <password> /user:"<username>" /persistent:Yes
net use "\\10.8.0.1\share\users\<username>" /savecred

%SystemRoot%\explorer.exe "\\10.8.0.1\share\users\<username>"