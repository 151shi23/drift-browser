; Drift 浏览器安装脚本
; 使用 Inno Setup Compiler 编译此脚本

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName=Drift 浏览器
AppVersion=1.0.0
AppVerName=Drift 浏览器 v1.0.0
AppPublisher=Drift
AppPublisherURL=https://github.com/drift-browser
AppSupportURL=https://github.com/drift-browser
AppUpdatesURL=https://github.com/drift-browser
DefaultDirName={autopf}\Drift
DefaultGroupName=Drift 浏览器
AllowNoIcons=yes
OutputDir=dist\installer
OutputBaseFilename=Drift-Setup-v1.0.0
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
UninstallDisplayIcon={app}\Drift 浏览器.exe
UninstallDisplayName=Drift 浏览器
VersionInfoVersion=1.0.0
VersionInfoCompany=Drift
VersionInfoDescription=Drift 浏览器安装程序
VersionInfoCopyright=Copyright (C) 2024 Drift
VersionInfoProductName=Drift 浏览器
VersionInfoProductVersion=1.0.0

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
; 主程序
Source: "dist\win-unpacked\Drift 浏览器.exe"; DestDir: "{app}"; Flags: ignoreversion

; DLL 文件
Source: "dist\win-unpacked\d3dcompiler_47.dll"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "dist\win-unpacked\ffmpeg.dll"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "dist\win-unpacked\libEGL.dll"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "dist\win-unpacked\libGLESv2.dll"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "dist\win-unpacked\vk_swiftshader.dll"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "dist\win-unpacked\vulkan-1.dll"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

; 资源文件
Source: "dist\win-unpacked\chrome_100_percent.pak"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "dist\win-unpacked\chrome_200_percent.pak"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "dist\win-unpacked\resources.pak"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "dist\win-unpacked\snapshot_blob.bin"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "dist\win-unpacked\v8_context_snapshot.bin"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "dist\win-unpacked\icudtl.dat"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "dist\win-unpacked\version"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "dist\win-unpacked\vk_swiftshader_icd.json"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

; 本地化文件
Source: "dist\win-unpacked\locales\*.pak"; DestDir: "{app}\locales"; Flags: ignoreversion skipifsourcedoesntexist

; 许可证
Source: "dist\win-unpacked\LICENSE.electron.txt"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "dist\win-unpacked\LICENSES.chromium.html"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

; resources 目录（包含 app.asar）
Source: "dist\win-unpacked\resources\*"; DestDir: "{app}\resources"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist

[Icons]
Name: "{group}\Drift 浏览器"; Filename: "{app}\Drift 浏览器.exe"
Name: "{group}\{cm:UninstallProgram,Drift 浏览器}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Drift 浏览器"; Filename: "{app}\Drift 浏览器.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Drift 浏览器.exe"; Description: "{cm:LaunchProgram,Drift 浏览器}"; Flags: nowait postinstall skipifsilent

[Registry]
; 注册默认浏览器能力
Root: HKCU; Subkey: "Software\RegisteredApplications"; ValueType: string; ValueName: "Drift"; ValueData: "Software\Drift\Capabilities"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Drift\Capabilities"; ValueType: string; ValueName: "ApplicationName"; ValueData: "Drift 浏览器"
Root: HKCU; Subkey: "Software\Drift\Capabilities"; ValueType: string; ValueName: "ApplicationIcon"; ValueData: "{app}\Drift 浏览器.exe,0"
Root: HKCU; Subkey: "Software\Drift\Capabilities"; ValueType: string; ValueName: "ApplicationDescription"; ValueData: "Drift - 现代化浏览器"
Root: HKCU; Subkey: "Software\Drift\Capabilities\URLAssociations"; ValueType: string; ValueName: "http"; ValueData: "DriftURL"
Root: HKCU; Subkey: "Software\Drift\Capabilities\URLAssociations"; ValueType: string; ValueName: "https"; ValueData: "DriftURL"

; URL 协议关联
Root: HKCU; Subkey: "Software\Classes\DriftURL"; ValueType: string; ValueName: ""; ValueData: "Drift URL Protocol"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\DriftURL"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\DriftURL\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\Drift 浏览器.exe,0"
Root: HKCU; Subkey: "Software\Classes\DriftURL\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\Drift 浏览器.exe"" ""%1"""

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
Type: filesandordirs; Name: "{localappdata}\Drift"
