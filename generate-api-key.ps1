# Generate API Key for Lelu Engine
# This script generates a test API key and stores it in Redis

Write-Host "Generating API Key..." -ForegroundColor Cyan

# Generate a random 32-byte key
$randomBytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($randomBytes)
$randomPart = [Convert]::ToBase64String($randomBytes).Replace('+', '-').Replace('/', '_').TrimEnd('=')

# Create API key with test prefix
$apiKey = "lelu_test_$randomPart"
$tenantID = "tenant_dev_001"
$keyID = $randomPart.Substring(0, 16)
$createdAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

# Create metadata JSON
$metadata = @"
{"tenant_id":"$tenantID","key_id":"$keyID","created_at":"$createdAt","revoked":false,"name":"Development Key","env":"test"}
"@

Write-Host "`nGenerated API Key:" -ForegroundColor Green
Write-Host $apiKey -ForegroundColor Yellow

Write-Host "`nStoring in Redis..." -ForegroundColor Cyan

# Store in Redis using docker exec
$redisKey = "lelu:apikey:$apiKey"
docker exec lelu-redis redis-cli SET $redisKey $metadata

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ API Key stored successfully!" -ForegroundColor Green
    Write-Host "`nYou can now use this key to test the engine:" -ForegroundColor Cyan
    Write-Host "  curl -H `"X-API-Key: $apiKey`" http://localhost:8083/v1/authorize" -ForegroundColor White
    
    # Save to .env file
    Write-Host "`nAdding to .env file..." -ForegroundColor Cyan
    $envContent = Get-Content .env -Raw
    if ($envContent -match "LELU_API_KEY=") {
        $envContent = $envContent -replace "LELU_API_KEY=.*", "LELU_API_KEY=$apiKey"
    } else {
        $envContent += "`nLELU_API_KEY=$apiKey"
    }
    Set-Content .env $envContent
    Write-Host "✓ Updated .env file" -ForegroundColor Green
} else {
    Write-Host "`n✗ Failed to store key in Redis" -ForegroundColor Red
    Write-Host "Make sure Redis container is running: docker-compose ps" -ForegroundColor Yellow
}

Write-Host "`nKey Details:" -ForegroundColor Cyan
Write-Host "  Tenant ID: $tenantID" -ForegroundColor White
Write-Host "  Environment: test" -ForegroundColor White
Write-Host "  Created: $createdAt" -ForegroundColor White
