# 7pace MCP Server Setup Script for Windows/PowerShell

Write-Host "🚀 Setting up 7pace MCP Server..." -ForegroundColor Green

# Check Node.js installation
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Build TypeScript
Write-Host "Building TypeScript..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build project" -ForegroundColor Red
    exit 1
}

# Check if env.example exists and create .env if needed
if (Test-Path "env.example") {
    if (-not (Test-Path ".env")) {
        Write-Host "Creating .env file from template..." -ForegroundColor Yellow
        Copy-Item "env.example" ".env"
        Write-Host "📝 Please edit .env file with your actual 7pace token and organization" -ForegroundColor Cyan
    } else {
        Write-Host "✅ .env file already exists" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Edit .env file with your 7pace credentials:" -ForegroundColor White
Write-Host "   - SEVENPACE_ORGANIZATION=labournet" -ForegroundColor Gray
Write-Host "   - SEVENPACE_TOKEN=your_token_here" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Get your 7pace API token:" -ForegroundColor White
Write-Host "   - Go to Azure DevOps → 7pace Timetracker" -ForegroundColor Gray
Write-Host "   - Settings → API & Reporting → Create New Token" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test the server:" -ForegroundColor White
Write-Host "   npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Add to Cursor MCP configuration:" -ForegroundColor White
Write-Host "   See cursor-mcp-config.json for example" -ForegroundColor Gray
