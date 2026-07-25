# setup-tiktok-trends.ps1
# Script de configuracion del modulo TikTok Trends para GlowApp

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "=  GlowApp - Setup Modulo TikTok Trends                      =" -ForegroundColor Cyan
Write-Host "=  Fase 1: Instalacion de dependencias y migracion DB       =" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""

# ================================================================
# FUNCION: Validar directorio
# ================================================================
function Test-ProjectDirectory {
    Write-Host "[CHECK] Validando directorio del proyecto..." -ForegroundColor Yellow
    $packageJsonPath = Join-Path $PWD "package.json"
    if (-not (Test-Path $packageJsonPath)) {
        Write-Host "[ERROR] ERROR: No se encontro package.json" -ForegroundColor Red
        Write-Host "   Ejecuta este script desde la raiz de glowapp-backend" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Directorio valido: $PWD" -ForegroundColor Green
    Write-Host ""
}

function Test-NodeInstallation {
    Write-Host "[CHECK] Validando Node.js y npm..." -ForegroundColor Yellow
    try {
        $nodeVersion = node --version
        $npmVersion = npm --version
        Write-Host "[OK] Node.js: $nodeVersion" -ForegroundColor Green
        Write-Host "[OK] npm: $npmVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "[ERROR] ERROR: Node.js o npm no estan instalados" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
}

function Test-TikTokConnectivity {
    Write-Host "[CHECK] Validando conectividad a TikTok..." -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "https://ads.tiktok.com" -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            Write-Host "[OK] Conectividad a TikTok OK" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "[WARN]  ADVERTENCIA: No se pudo conectar a ads.tiktok.com" -ForegroundColor Yellow
        Write-Host "   El scraper podria fallar en produccion" -ForegroundColor Yellow
        $continue = Read-Host "Continuar de todos modos? (s/n)"
        if ($continue -ne "s") { exit 0 }
    }
    Write-Host ""
}

function Install-NpmDependencies {
    Write-Host "[PKG] Instalando dependencias npm..." -ForegroundColor Cyan
    $dependencies = @("playwright", "axios", "node-cron")
    
    foreach ($dep in $dependencies) {
        Write-Host "   Instalando $dep..." -ForegroundColor Gray
        npm install $dep --save
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] ERROR: Fallo al instalar $dep" -ForegroundColor Red
            exit 1
        }
    }
    
    Write-Host "[OK] Dependencias npm instaladas" -ForegroundColor Green
    Write-Host ""
}

function Install-Playwright {
    Write-Host "[SETUP] Instalando Playwright..." -ForegroundColor Cyan
    Write-Host "   Nota: En PaaS se instalara via Dockerfile" -ForegroundColor Gray
    
    $installPlaywright = Read-Host "Instalar Playwright localmente? (s/n)"
    if ($installPlaywright -eq "s") {
        npx playwright install chromium
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[WARN]  Playwright no se instalo correctamente" -ForegroundColor Yellow
        }
        else {
            Write-Host "[OK] Playwright instalado" -ForegroundColor Green
        }
    }
    else {
        Write-Host "[INFO]  Playwright se instalara en el PaaS" -ForegroundColor Gray
    }
    Write-Host ""
}

function New-ModuleStructure {
    Write-Host "[DIR] Creando estructura de carpetas..." -ForegroundColor Cyan
    
    $modulePath = "src\modules\tiktok-trends"
    $subdirs = @("scraper", "models", "migrations", "routes", "jobs")
    
    foreach ($subdir in $subdirs) {
        $fullPath = Join-Path $modulePath $subdir
        if (-not (Test-Path $fullPath)) {
            New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
            Write-Host "   [OK] Creado: $fullPath" -ForegroundColor Green
        }
        else {
            Write-Host "   [INFO]  Ya existe: $fullPath" -ForegroundColor Gray
        }
    }
    Write-Host ""
}

function New-EnvExample {
    Write-Host "[FILE] Creando .env.example..." -ForegroundColor Cyan
    
    $envExamplePath = Join-Path $PWD ".env.example"
    
    $envContent = @"
# TikTok Trends Module Configuration
TIKTOK_TRENDS_ENABLED=true
TIKTOK_TRENDS_CRON_ENABLED=true
RUN_TIKTOK_JOB_NOW=false
TIKTOK_RATE_LIMIT_MS=3000
TIKTOK_PAGE_SIZE=100
TIKTOK_PERIODS=7,30,120
"@
    
    if (-not (Test-Path $envExamplePath)) {
        Set-Content -Path $envExamplePath -Value $envContent -Encoding UTF8
        Write-Host "[OK] Creado: .env.example" -ForegroundColor Green
    }
    else {
        Write-Host "[INFO]  .env.example ya existe" -ForegroundColor Gray
        Add-Content -Path $envExamplePath -Value "`n$envContent" -Encoding UTF8
    }
    Write-Host ""
}

function Test-MigrationFile {
    Write-Host "[DB]  Verificando archivo de migracion..." -ForegroundColor Cyan
    
    $migrationPath = "src\modules\tiktok-trends\migrations\20260705-create-tiktok-hashtag-trends.js"
    
    if (-not (Test-Path $migrationPath)) {
        Write-Host "[WARN]  ATENCION: Copia el archivo de migracion desde el documento" -ForegroundColor Yellow
        Write-Host "   Ruta: $migrationPath" -ForegroundColor Yellow
        $migrationCopied = Read-Host "Ya lo copiaste? (s/n)"
        if ($migrationCopied -ne "s") {
            Write-Host "[ERROR] Copia el archivo y vuelve a ejecutar" -ForegroundColor Red
            exit 1
        }
    }
    else {
        Write-Host "[OK] Archivo de migracion existe" -ForegroundColor Green
    }
    Write-Host ""
}

function Invoke-DatabaseMigration {
    Write-Host "[DB]  Ejecutando migracion..." -ForegroundColor Cyan
    
    $runMigration = Read-Host "Ejecutar migracion ahora? (s/n)"
    if ($runMigration -eq "s") {
        npx sequelize-cli db:migrate
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[WARN]  Migracion fallo. Ejecuta manualmente: npx sequelize-cli db:migrate" -ForegroundColor Yellow
        }
        else {
            Write-Host "[OK] Migracion ejecutada" -ForegroundColor Green
        }
    }
    else {
        Write-Host "[INFO]  Migracion omitida" -ForegroundColor Gray
    }
    Write-Host ""
}

function Test-CodeFiles {
    Write-Host "[FILES] Verificando archivos de codigo..." -ForegroundColor Cyan
    
    $files = @(
        "src\modules\tiktok-trends\scraper\tiktokCreativeCenterScraper.js",
        "src\modules\tiktok-trends\scraper\categoryClassifier.js",
        "src\modules\tiktok-trends\models\TiktokHashtagTrend.js",
        "src\modules\tiktok-trends\routes\tiktokTrends.routes.js",
        "src\modules\tiktok-trends\jobs\weeklyTiktokTrendsJob.js",
        "src\modules\tiktok-trends\index.js"
    )
    
    $missingCount = 0
    foreach ($file in $files) {
        if (-not (Test-Path $file)) {
            Write-Host "   [WARN]  Falta: $file" -ForegroundColor Yellow
            $missingCount++
        }
        else {
            Write-Host "   [OK] Existe: $file" -ForegroundColor Green
        }
    }
    
    if ($missingCount -gt 0) {
        Write-Host ""
        Write-Host "[WARN]  Faltan $missingCount archivos. Copia el codigo desde el documento." -ForegroundColor Yellow
    }
    Write-Host ""
}

function Invoke-FinalValidation {
    Write-Host "==============================================================" -ForegroundColor Cyan
    Write-Host "=  VALIDACION FINAL                                          =" -ForegroundColor Cyan
    Write-Host "==============================================================" -ForegroundColor Cyan
    Write-Host ""
    
    $allPassed = $true
    
    Write-Host "[CHECK] Verificando dependencias npm..." -ForegroundColor Yellow
    npm list playwright axios node-cron --depth=0 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Dependencias OK" -ForegroundColor Green
    }
    else {
        Write-Host "   [ERROR] Dependencias faltan" -ForegroundColor Red
        $allPassed = $false
    }
    
    Write-Host "[CHECK] Verificando estructura..." -ForegroundColor Yellow
    if (Test-Path "src\modules\tiktok-trends\scraper") {
        Write-Host "   [OK] Estructura OK" -ForegroundColor Green
    }
    else {
        Write-Host "   [ERROR] Estructura incompleta" -ForegroundColor Red
        $allPassed = $false
    }
    
    Write-Host "[CHECK] Verificando .env.example..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Write-Host "   [OK] .env.example OK" -ForegroundColor Green
    }
    else {
        Write-Host "   [ERROR] .env.example falta" -ForegroundColor Red
        $allPassed = $false
    }
    
    Write-Host ""
    
    if ($allPassed) {
        Write-Host "==============================================================" -ForegroundColor Green
        Write-Host "=  [OK] FASE 1 COMPLETADA EXITOSAMENTE                         =" -ForegroundColor Green
        Write-Host "==============================================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Proximos pasos:" -ForegroundColor Cyan
        Write-Host "1. Copia los archivos de codigo desde el documento" -ForegroundColor White
        Write-Host "2. Configura las variables en .env" -ForegroundColor White
        Write-Host "3. Ejecuta la migracion si no lo hiciste" -ForegroundColor White
        Write-Host "4. Pasa a la Fase 2: Prueba del scraper" -ForegroundColor White
    }
    else {
        Write-Host "==============================================================" -ForegroundColor Yellow
        Write-Host "=  [WARN]  FASE 1 COMPLETADA CON ADVERTENCIAS                    =" -ForegroundColor Yellow
        Write-Host "==============================================================" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Revisa los errores arriba" -ForegroundColor Yellow
    }
    Write-Host ""
}

Test-ProjectDirectory
Test-NodeInstallation
Test-TikTokConnectivity
Install-NpmDependencies
Install-Playwright
New-ModuleStructure
New-EnvExample
Test-MigrationFile
Invoke-DatabaseMigration
Test-CodeFiles
Invoke-FinalValidation

Write-Host "Presiona cualquier tecla para salir..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")