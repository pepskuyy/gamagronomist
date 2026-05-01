$javaHome = 'C:\Program Files\Eclipse Adoptium\jdk-21.0.10.7-hotspot'
$javaBin  = "$javaHome\bin"

# Set JAVA_HOME system-wide
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', $javaHome, 'Machine')

# Add to PATH if not already there
$currentPath = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine')
if ($currentPath -notlike "*jdk-21*") {
    [System.Environment]::SetEnvironmentVariable('PATH', "$javaBin;$currentPath", 'Machine')
    Write-Host "PATH updated with Java bin"
} else {
    Write-Host "Java already in PATH"
}

Write-Host "JAVA_HOME = $javaHome"
Write-Host "Done! Please restart your terminal for changes to take effect."
