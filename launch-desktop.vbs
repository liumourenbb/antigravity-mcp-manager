Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strCurDir = fso.GetParentFolderName(WScript.ScriptFullName)

' 1. Check primary Windows 11 standalone executable
strExe = strCurDir & "\dist\windows11\windows11.exe"
If fso.FileExists(strExe) Then
    WshShell.Run """" & strExe & """", 0, False
    WScript.Quit
End If

' 2. Check root windows11.exe launcher
strExe = strCurDir & "\windows11.exe"
If fso.FileExists(strExe) Then
    WshShell.Run """" & strExe & """", 0, False
    WScript.Quit
End If

' 3. Check legacy dist executable
strExe = strCurDir & "\dist\Antigravity-MCP-Manager\Antigravity-MCP-Manager.exe"
If fso.FileExists(strExe) Then
    WshShell.Run """" & strExe & """", 0, False
    WScript.Quit
End If

' 4. Fallback to local Electron runtime
strExe = strCurDir & "\node_modules\electron\dist\electron.exe"
If fso.FileExists(strExe) Then
    WshShell.Run """" & strExe & """ """ & strCurDir & """", 0, False
Else
    WshShell.Run """" & strCurDir & "\node_modules\.bin\electron.cmd"" """ & strCurDir & """", 0, False
End If
