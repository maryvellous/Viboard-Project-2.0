param(
  [string]$ConfigPath = ".\config.json",
  [string]$Name,
  [string]$Version,
  [string]$SourceDir,
  [string]$Executable,
  [string]$Icon,
  [ValidateSet("x86", "x64")]
  [string]$Architecture,
  [ValidateSet("currentUser", "allUsers")]
  [string]$InstallScope,
  [string]$OutputDir,
  [switch]$NoCompile,
  [switch]$KeepBuildFiles
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$templatePath = Join-Path $repoRoot "installer\diaspro-installer.iss"

function Get-OptionalProperty {
  param(
    [Parameter(Mandatory = $true)]$Object,
    [Parameter(Mandatory = $true)][string]$Name,
    $Default = $null
  )

  if ($null -eq $Object) {
    return $Default
  }

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property -or $null -eq $property.Value -or $property.Value -eq "") {
    return $Default
  }

  return $property.Value
}

function Set-ObjectProperty {
  param(
    [Parameter(Mandatory = $true)]$Object,
    [Parameter(Mandatory = $true)][string]$Name,
    $Value
  )

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) {
    $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value
  }
  else {
    $property.Value = $Value
  }
}

function Resolve-RelativePath {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$BaseDirectory
  )

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }

  return [System.IO.Path]::GetFullPath((Join-Path $BaseDirectory $Path))
}

function Quote-InnoString {
  param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value)

  return '"' + ($Value -replace '"', '""') + '"'
}

function Get-SafeSlug {
  param([Parameter(Mandatory = $true)][string]$Value)

  $slug = $Value.ToLowerInvariant()
  $slug = [regex]::Replace($slug, "[^a-z0-9]+", ".")
  $slug = $slug.Trim(".")
  if ([string]::IsNullOrWhiteSpace($slug)) {
    return "app"
  }

  return $slug
}

function Find-InnoCompiler {
  param([string]$ConfiguredPath)

  if (-not [string]::IsNullOrWhiteSpace($ConfiguredPath)) {
    $candidate = Resolve-RelativePath -Path $ConfiguredPath -BaseDirectory $configDirectory
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return $candidate
    }

    throw "Inno Setup non trovato nel percorso configurato: $candidate"
  }

  $candidates = [System.Collections.Generic.List[string]]::new()

  if ($env:ProgramFiles) {
    $candidates.Add((Join-Path $env:ProgramFiles "Inno Setup 7\ISCC.exe"))
  }

  $programFilesX86 = [Environment]::GetFolderPath([Environment+SpecialFolder]::ProgramFilesX86)
  if ($programFilesX86) {
    $candidates.Add((Join-Path $programFilesX86 "Inno Setup 7\ISCC.exe"))
  }

  if ($env:LOCALAPPDATA) {
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 7\ISCC.exe"))
  }

  $command = Get-Command "ISCC.exe" -ErrorAction SilentlyContinue
  if ($null -ne $command) {
    $candidates.Add($command.Source)
  }

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return $candidate
    }
  }

  throw @"
Inno Setup 7 non trovato.

Installa Inno Setup 7 da https://jrsoftware.org/isdl.php
oppure indica il compilatore in config.json:

"installer": {
  "innoCompilerPath": "C:\\Program Files\\Inno Setup 7\\ISCC.exe"
}
"@
}

$configFile = Resolve-RelativePath -Path $ConfigPath -BaseDirectory (Get-Location).Path
$configDirectory = Split-Path -Parent $configFile

if (Test-Path -LiteralPath $configFile -PathType Leaf) {
  Write-Host "Config: $configFile" -ForegroundColor DarkGray
  $config = Get-Content -LiteralPath $configFile -Raw -Encoding UTF8 | ConvertFrom-Json

  if ($null -eq $config.app) {
    throw "Il file di configurazione deve contenere la sezione 'app'."
  }

  if ($null -eq $config.installer) {
    $config | Add-Member -NotePropertyName installer -NotePropertyValue ([pscustomobject]@{})
  }
}
else {
  if ([string]::IsNullOrWhiteSpace($Name) -or
      [string]::IsNullOrWhiteSpace($Version) -or
      [string]::IsNullOrWhiteSpace($SourceDir) -or
      [string]::IsNullOrWhiteSpace($Executable)) {
    throw @"
Config non trovato: $configFile

Copia config.example.json in config.json oppure passa almeno:
  -Name
  -Version
  -SourceDir
  -Executable

Esempio:
  .\build.ps1 -Name "Viboard" -Version "2.0.0" -SourceDir "C:\build\Viboard" -Executable "Viboard.exe" -Icon "C:\build\Viboard.ico"
"@
  }

  $configDirectory = (Get-Location).Path
  $slug = Get-SafeSlug -Value $Name

  $config = [pscustomobject]@{
    app = [pscustomobject]@{
      name = $Name
      version = $Version
      publisher = "Diaspro"
      publisherUrl = ""
      appId = "it.diaspro.$slug"
      description = "$Name per Windows"
      sourceDir = $SourceDir
      executable = $Executable
      icon = $Icon
    }
    installer = [pscustomobject]@{
      architecture = "x64"
      installScope = "currentUser"
      allowScopeChoice = $true
      desktopShortcut = $true
      startMenuShortcut = $true
      launchAfterInstall = $true
      outputDir = ".\dist"
      outputName = "{name}-{version}-Setup"
    }
  }
}

if ($PSBoundParameters.ContainsKey("Name")) {
  Set-ObjectProperty -Object $config.app -Name "name" -Value $Name
}
if ($PSBoundParameters.ContainsKey("Version")) {
  Set-ObjectProperty -Object $config.app -Name "version" -Value $Version
}
if ($PSBoundParameters.ContainsKey("SourceDir")) {
  Set-ObjectProperty -Object $config.app -Name "sourceDir" -Value $SourceDir
}
if ($PSBoundParameters.ContainsKey("Executable")) {
  Set-ObjectProperty -Object $config.app -Name "executable" -Value $Executable
}
if ($PSBoundParameters.ContainsKey("Icon")) {
  Set-ObjectProperty -Object $config.app -Name "icon" -Value $Icon
}
if ($PSBoundParameters.ContainsKey("Architecture")) {
  Set-ObjectProperty -Object $config.installer -Name "architecture" -Value $Architecture
}
if ($PSBoundParameters.ContainsKey("InstallScope")) {
  Set-ObjectProperty -Object $config.installer -Name "installScope" -Value $InstallScope
}
if ($PSBoundParameters.ContainsKey("OutputDir")) {
  Set-ObjectProperty -Object $config.installer -Name "outputDir" -Value $OutputDir
}

$appName = [string](Get-OptionalProperty -Object $config.app -Name "name")
$appVersion = [string](Get-OptionalProperty -Object $config.app -Name "version")
$appPublisher = [string](Get-OptionalProperty -Object $config.app -Name "publisher" -Default "Diaspro")
$appPublisherUrl = [string](Get-OptionalProperty -Object $config.app -Name "publisherUrl" -Default "")
$appId = [string](Get-OptionalProperty -Object $config.app -Name "appId" -Default ("it.diaspro." + (Get-SafeSlug -Value $appName)))
$appDescription = [string](Get-OptionalProperty -Object $config.app -Name "description" -Default "$appName per Windows")
$sourceDirValue = [string](Get-OptionalProperty -Object $config.app -Name "sourceDir")
$appExe = [string](Get-OptionalProperty -Object $config.app -Name "executable")
$iconValue = [string](Get-OptionalProperty -Object $config.app -Name "icon" -Default "")
$fileAssociations = @(Get-OptionalProperty -Object $config.app -Name "fileAssociations" -Default @())

if ([string]::IsNullOrWhiteSpace($appName)) { throw "Manca app.name." }
if ([string]::IsNullOrWhiteSpace($appVersion)) { throw "Manca app.version." }
if ([string]::IsNullOrWhiteSpace($sourceDirValue)) { throw "Manca app.sourceDir." }
if ([string]::IsNullOrWhiteSpace($appExe)) { throw "Manca app.executable." }

$sourceDir = Resolve-RelativePath -Path $sourceDirValue -BaseDirectory $configDirectory
if (-not (Test-Path -LiteralPath $sourceDir -PathType Container)) {
  throw "Cartella build non trovata: $sourceDir"
}

$appExe = $appExe.Replace("/", "\")
$mainExePath = Join-Path $sourceDir $appExe
if (-not (Test-Path -LiteralPath $mainExePath -PathType Leaf)) {
  throw "Eseguibile principale non trovato: $mainExePath"
}

$appExeDir = Split-Path -Parent $appExe
if ($appExeDir -eq ".") {
  $appExeDir = ""
}

$hasIcon = 0
$appIcon = ""
if (-not [string]::IsNullOrWhiteSpace($iconValue)) {
  $appIcon = Resolve-RelativePath -Path $iconValue -BaseDirectory $configDirectory
  if (-not (Test-Path -LiteralPath $appIcon -PathType Leaf)) {
    throw "Icona non trovata: $appIcon"
  }

  if ([System.IO.Path]::GetExtension($appIcon).ToLowerInvariant() -ne ".ico") {
    throw "L'icona del setup deve essere un file .ico: $appIcon"
  }

  $hasIcon = 1
}

$architectureValue = [string](Get-OptionalProperty -Object $config.installer -Name "architecture" -Default "x64")
if ($architectureValue -notin @("x86", "x64")) {
  throw "installer.architecture deve essere 'x86' oppure 'x64'."
}

$scopeValue = [string](Get-OptionalProperty -Object $config.installer -Name "installScope" -Default "currentUser")
switch ($scopeValue) {
  "currentUser" { $privilegesRequired = "lowest" }
  "allUsers" { $privilegesRequired = "admin" }
  default { throw "installer.installScope deve essere 'currentUser' oppure 'allUsers'." }
}

$allowScopeChoice = [bool](Get-OptionalProperty -Object $config.installer -Name "allowScopeChoice" -Default $true)
$desktopShortcut = [bool](Get-OptionalProperty -Object $config.installer -Name "desktopShortcut" -Default $true)
$startMenuShortcut = [bool](Get-OptionalProperty -Object $config.installer -Name "startMenuShortcut" -Default $true)
$launchAfterInstall = [bool](Get-OptionalProperty -Object $config.installer -Name "launchAfterInstall" -Default $true)

$outputDirValue = [string](Get-OptionalProperty -Object $config.installer -Name "outputDir" -Default ".\dist")
$outputDirectory = Resolve-RelativePath -Path $outputDirValue -BaseDirectory $configDirectory
[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null

$outputNameTemplate = [string](Get-OptionalProperty -Object $config.installer -Name "outputName" -Default "{name}-{version}-Setup")
$outputName = $outputNameTemplate.Replace("{name}", $appName).Replace("{version}", $appVersion)
$outputName = [regex]::Replace($outputName, '[<>:"/\\|?*]', "-")
$outputName = $outputName.Trim().TrimEnd(".")
if ([string]::IsNullOrWhiteSpace($outputName)) {
  throw "Il nome dell'installer risultante è vuoto."
}

$buildDirectory = Join-Path $repoRoot ".diaspro-build"
if (Test-Path -LiteralPath $buildDirectory) {
  Remove-Item -LiteralPath $buildDirectory -Recurse -Force
}
[System.IO.Directory]::CreateDirectory($buildDirectory) | Out-Null

$associationsPath = Join-Path $buildDirectory "file-associations.iss"
$associationLines = [System.Collections.Generic.List[string]]::new()

if ($fileAssociations.Count -gt 0) {
  $associationLines.Add("[Registry]")

  foreach ($association in $fileAssociations) {
    $associationName = [string](Get-OptionalProperty -Object $association -Name "name" -Default "Documento $appName")
    $associationDescription = [string](Get-OptionalProperty -Object $association -Name "description" -Default $associationName)
    $associationProgId = [string](Get-OptionalProperty -Object $association -Name "progId" -Default ($appId + ".file"))
    $extensions = @(Get-OptionalProperty -Object $association -Name "extensions" -Default @())

    if ($extensions.Count -eq 0) {
      throw "Ogni app.fileAssociations[] deve contenere almeno una estensione."
    }

    if ([string]::IsNullOrWhiteSpace($associationProgId)) {
      throw "app.fileAssociations[].progId non può essere vuoto."
    }

    $progIdKey = Quote-InnoString ("Software\Classes\" + $associationProgId)
    $associationLines.Add(
      'Root: HKA; Subkey: ' + $progIdKey +
      '; ValueType: string; ValueName: ""; ValueData: ' + (Quote-InnoString $associationDescription) +
      '; Flags: uninsdeletekey'
    )
    $associationLines.Add(
      'Root: HKA; Subkey: ' + (Quote-InnoString ("Software\Classes\" + $associationProgId + "\DefaultIcon")) +
      '; ValueType: string; ValueName: ""; ValueData: "{app}\{#AppExe},0"'
    )
    $associationLines.Add(
      'Root: HKA; Subkey: ' + (Quote-InnoString ("Software\Classes\" + $associationProgId + "\shell\open\command")) +
      '; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExe}"" ""%1"""'
    )

    foreach ($extensionValue in $extensions) {
      $extension = [string]$extensionValue
      if (-not $extension.StartsWith(".")) {
        $extension = "." + $extension
      }

      if ($extension -notmatch '^\.[A-Za-z0-9][A-Za-z0-9._+-]*$') {
        throw "Estensione file non valida in app.fileAssociations: $extension"
      }

      $associationLines.Add(
        'Root: HKA; Subkey: ' + (Quote-InnoString ("Software\Classes\" + $extension)) +
        '; ValueType: string; ValueName: ""; ValueData: ' + (Quote-InnoString $associationProgId) +
        '; Flags: uninsdeletevalue'
      )
    }
  }
}

[System.IO.File]::WriteAllLines($associationsPath, [string[]]$associationLines, [System.Text.UTF8Encoding]::new($false))

$definesPath = Join-Path $buildDirectory "app-defines.iss"
$defines = @(
  ("#define AppId " + (Quote-InnoString $appId))
  ("#define AppName " + (Quote-InnoString $appName))
  ("#define AppVersion " + (Quote-InnoString $appVersion))
  ("#define AppPublisher " + (Quote-InnoString $appPublisher))
  ("#define AppPublisherUrl " + (Quote-InnoString $appPublisherUrl))
  ("#define HasPublisherUrl " + $(if ([string]::IsNullOrWhiteSpace($appPublisherUrl)) { "0" } else { "1" }))
  ("#define AppDescription " + (Quote-InnoString $appDescription))
  ("#define SourceDir " + (Quote-InnoString $sourceDir))
  ("#define AppExe " + (Quote-InnoString $appExe))
  ("#define AppExeDir " + (Quote-InnoString $appExeDir))
  ("#define AppIcon " + (Quote-InnoString $appIcon))
  "#define HasIcon $hasIcon"
  ("#define SetupArchitecture " + (Quote-InnoString $architectureValue))
  ("#define PrivilegesRequired " + (Quote-InnoString $privilegesRequired))
  ("#define AllowScopeChoice " + $(if ($allowScopeChoice) { "1" } else { "0" }))
  ("#define DesktopShortcut " + $(if ($desktopShortcut) { "1" } else { "0" }))
  ("#define StartMenuShortcut " + $(if ($startMenuShortcut) { "1" } else { "0" }))
  ("#define LaunchAfterInstall " + $(if ($launchAfterInstall) { "1" } else { "0" }))
  ("#define OutputDir " + (Quote-InnoString $outputDirectory))
  ("#define OutputName " + (Quote-InnoString $outputName))
)
[System.IO.File]::WriteAllLines($definesPath, [string[]]$defines, [System.Text.UTF8Encoding]::new($false))

$wrapperPath = Join-Path $buildDirectory "build.iss"
$definesForInclude = $definesPath.Replace('"', '""')
$templateForInclude = $templatePath.Replace('"', '""')
$associationsForInclude = $associationsPath.Replace('"', '""')

$wrapper = @"
#preproc ispp
#include "$definesForInclude"
#include "$templateForInclude"
#include "$associationsForInclude"
"@
Set-Content -LiteralPath $wrapperPath -Value $wrapper -Encoding UTF8

Write-Host ""
Write-Host "Diaspro Installer" -ForegroundColor Magenta
Write-Host "  App:       $appName $appVersion"
Write-Host "  Sorgente:  $sourceDir"
Write-Host "  Exe:       $appExe"
Write-Host "  Scope:     $scopeValue"
Write-Host "  Arch:      $architectureValue"
Write-Host "  Output:    $(Join-Path $outputDirectory ($outputName + '.exe'))"
Write-Host ""

if ($NoCompile) {
  Write-Host "Configurazione valida. Compilazione saltata (-NoCompile)." -ForegroundColor Yellow
  Write-Host "Script generato: $wrapperPath" -ForegroundColor DarkGray
  return
}

$configuredCompiler = [string](Get-OptionalProperty -Object $config.installer -Name "innoCompilerPath" -Default "")
$iscc = Find-InnoCompiler -ConfiguredPath $configuredCompiler

$compilerVersion = (& $iscc "--version" 2>&1 | Out-String).Trim()
if ($compilerVersion -notmatch "(\d+)\.(\d+)") {
  throw "Impossibile determinare la versione di Inno Setup: $compilerVersion"
}

if ([int]$Matches[1] -lt 7) {
  throw "Diaspro Installer richiede Inno Setup 7 o successivo. Trovato: $compilerVersion"
}

Write-Host "Compilatore: $compilerVersion" -ForegroundColor DarkGray

& $iscc "--quiet-progress" $wrapperPath
if ($LASTEXITCODE -ne 0) {
  throw "Compilazione Inno Setup fallita (exit code $LASTEXITCODE). File temporanei lasciati in $buildDirectory"
}

$installerPath = Join-Path $outputDirectory ($outputName + ".exe")
if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf)) {
  throw "Compilazione terminata ma installer non trovato: $installerPath"
}

Write-Host ""
Write-Host "Installer pronto:" -ForegroundColor Green
Write-Host "  $installerPath" -ForegroundColor Green

if (-not $KeepBuildFiles) {
  Remove-Item -LiteralPath $buildDirectory -Recurse -Force
}
