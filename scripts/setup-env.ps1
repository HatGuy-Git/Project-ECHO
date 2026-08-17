# Write .env AWS keys from the local AWS CLI profile (same idea as Continuum).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root ".env"

$accessKey = aws configure get aws_access_key_id
$secretKey = aws configure get aws_secret_access_key
$region = aws configure get region
if (-not $region) { $region = "us-east-1" }

if (-not $accessKey -or -not $secretKey) {
  Write-Error "aws configure has no access key / secret. Run aws configure first."
}

@"
AWS_ACCESS_KEY_ID=$accessKey
AWS_SECRET_ACCESS_KEY=$secretKey
AWS_REGION=$region
AWS_SECRET_NAME=ace-mode/config
"@ | Set-Content -Path $envPath -Encoding utf8

Write-Host "Wrote AWS credentials to .env (other secrets stay in Secrets Manager)."
