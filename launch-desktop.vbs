Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strCurDir = fso.GetParentFolderName(WScript.ScriptFullName)

strExe = strCurDir & "\dist\Antigravity-MCP-Manager\Antigravity-MCP-Manager.exe"
If fso.FileExists(strExe) Then
    WshShell.Run """" & strExe & """", 0, False
Else
    strExe = strCurDir & "\node_modules\electron\dist\electron.exe"
    If fso.FileExists(strExe) Then
        WshShell.Run """" & strExe & """ """ & strCurDir & """", 0, False
    Else
        WshShell.Run """" & strCurDir & "\node_modules\.bin\electron.cmd"" """ & strCurDir & """", 0, False
    End If
End If
