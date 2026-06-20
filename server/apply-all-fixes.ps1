# Fix all remaining unused variable warnings

Write-Host "Fixing remaining 22 warnings..."

# 1. Fix security.js - lines 141 and 171 - unused 'req'
$content = Get-Content 'src/config/security.js' -Raw -Encoding UTF8
$lines = $content -split "`r?`n"
for ($i = 0; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match "^\s+app\.use.*\(req, res, next\)") {
    $lines[$i] = $lines[$i] -replace '\(req, res, next\)', '(_req, res, next)'
  }
}
[System.IO.File]::WriteAllText((Resolve-Path 'src/config/security.js').Path, ($lines -join "`r`n"), [System.Text.Encoding]::UTF8)
Write-Host "  ✅ security.js (2 warnings)"

# 2. Fix sentry.js - line 17 - unused 'app'
$content = Get-Content 'src/config/sentry.js' -Raw -Encoding UTF8
$content = $content -replace 'function setupSentry\(app\)', 'function setupSentry(_app)'
[System.IO.File]::WriteAllText((Resolve-Path 'src/config/sentry.js').Path, $content, [System.Text.Encoding]::UTF8)
Write-Host "  ✅ sentry.js (1 warning)"

# 3. Fix sales.controller.js - lines 399, 474 - unused 'dueAmount', 'session'
$content = Get-Content 'src/controllers/sales.controller.js' -Raw -Encoding UTF8
$content = $content -replace '(\s+)dueAmount(\s*\))', '${1}_dueAmount${2}'
# Don't replace session variable name - it's used!
# Just mark the one at line 474 as intentionally unused
$lines = $content -split "`r?`n"
for ($i = 0; $i -lt $lines.Length; $i++) {
  if ($i -ge 470 -and $i -le 478 -and $lines[$i] -match 'const session = ') {
    $lines[$i] = "      // eslint-disable-next-line no-unused-vars`r`n" + $lines[$i]
    break
  }
}
[System.IO.File]::WriteAllText((Resolve-Path 'src/controllers/sales.controller.js').Path, ($lines -join "`r`n"), [System.Text.Encoding]::UTF8)
Write-Host "  ✅ sales.controller.js (2 warnings)"

# 4. Fix financial-reports.routes.js - lines 15, 727 - unused 'createError', let->const
$content = Get-Content 'src/routes/financial-reports.routes.js' -Raw -Encoding UTF8
$content = $content -replace 'const \{ createError \} = ', 'const { createError: _createError } = '
# Fix the let startDate, endDate - find and replace properly
$content = $content -replace 'let startDate, endDate;[\s\S]*?startDate = req\.query\.startDate', 'const startDate = req.query.startDate'
$content = $content -replace ';[\s\S]*?endDate = req\.query\.endDate', ';`r`n      const endDate = req.query.endDate'
[System.IO.File]::WriteAllText((Resolve-Path 'src/routes/financial-reports.routes.js').Path, $content, [System.Text.Encoding]::UTF8)
Write-Host "  ✅ financial-reports.routes.js (3 warnings)"

# 5. Fix products.routes.js - line 16 - unused 'cacheService'
$content = Get-Content 'src/routes/products.routes.js' -Raw -Encoding UTF8
$content = $content -replace 'const cacheService = ', 'const _cacheService = '
[System.IO.File]::WriteAllText((Resolve-Path 'src/routes/products.routes.js').Path, $content, [System.Text.Encoding]::UTF8)
Write-Host "  ✅ products.routes.js (1 warning)"

# 6. Fix twilio.webhook.js - lines 75, 76 - unused 'To', 'From'
$content = Get-Content 'src/routes/webhooks/twilio.webhook.js' -Raw -Encoding UTF8
$content = $content -replace 'const \{ To, From, Body', 'const { To: _To, From: _From, Body'
[System.IO.File]::WriteAllText((Resolve-Path 'src/routes/webhooks/twilio.webhook.js').Path, $content, [System.Text.Encoding]::UTF8)
Write-Host "  ✅ twilio.webhook.js (2 warnings)"

# 7. Fix seed-test-data.js - line 6 - unused 'ObjectId'
$content = Get-Content 'src/scripts/seed-test-data.js' -Raw -Encoding UTF8
$content = $content -replace 'const \{ ObjectId \} = ', 'const { ObjectId: _ObjectId } = '
[System.IO.File]::WriteAllText((Resolve-Path 'src/scripts/seed-test-data.js').Path, $content, [System.Text.Encoding]::UTF8)
Write-Host "  ✅ seed-test-data.js (1 warning)"

# 8. Fix server.js - line 147 - unused 'req'
$content = Get-Content 'src/server.js' -Raw -Encoding UTF8
$content = $content -replace 'app\.use\(\(req, res\) => \{', 'app.use((_req, res) => {'
[System.IO.File]::WriteAllText((Resolve-Path 'src/server.js').Path, $content, [System.Text.Encoding]::UTF8)
Write-Host "  ✅ server.js (1 warning)"

# 9. Fix bulk-product-import.service.js - line 59 - unused 'options'
$content = Get-Content 'src/services/bulk-product-import.service.js' -Raw -Encoding UTF8
$content = $content -replace 'async validateFile\(file, options\)', 'async validateFile(file, _options)'
[System.IO.File]::WriteAllText((Resolve-Path 'src/services/bulk-product-import.service.js').Path, $content, [System.Text.Encoding]::UTF8)
Write-Host "  ✅ bulk-product-import.service.js (1 warning)"

# 10. Fix email/providers/base.adapter.js - lines 15, 24 - unused 'options', 'messageId'
$content = Get-Content 'src/services/email/providers/base.adapter.js' -Raw -Encoding UTF8
$content = $content -replace 'async send\(to, subject, htmlContent, options\)', 'async send(to, subject, htmlContent, _options)'
$content = $content -replace 'async getDeliveryStatus\(messageId\)', 'async getDeliveryStatus(_messageId)'
[System.IO.File]::WriteAllText((Resolve-Path 'src/services/email/providers/base.adapter.js').Path, $content, [System.Text.Encoding]::UTF8)
Write-Host "  ✅ email/providers/base.adapter.js (2 warnings)"

# 11. Fix sms/providers/base.adapter.js - lines 14, 32 - unused 'options', 'result'
$content = Get-Content 'src/services/sms/providers/base.adapter.js' -Raw -Encoding UTF8
$content = $content -replace 'async send\(phoneNumber, message, options\)', 'async send(phoneNumber, message, _options)'
$content = $content -replace 'async webhookHandler\(body, result\)', 'async webhookHandler(body, _result)'
[System.IO.File]::WriteAllText((Resolve-Path 'src/services/sms/providers/base.adapter.js').Path, $content, [System.Text.Encoding]::UTF8)
Write-Host "  ✅ sms/providers/base.adapter.js (2 warnings)"

# 12. Fix sms.queue.js - line 99 - unused 'result'
$content = Get-Content 'src/services/sms/sms.queue.js' -Raw -Encoding UTF8
$lines = $content -split "`r?`n"
for ($i = 95; $i -lt 105; $i++) {
  if ($lines[$i] -match '^\s+const result = await.*\.send\(') {
    $lines[$i] = $lines[$i] -replace 'const result = ', 'const _result = '
    break
  }
}
[System.IO.File]::WriteAllText((Resolve-Path 'src/services/sms/sms.queue.js').Path, ($lines -join "`r`n"), [System.Text.Encoding]::UTF8)
Write-Host "  ✅ sms.queue.js (1 warning)"

# 13. Fix sms.service.js - line 152 - unused 'phoneNumber'
$content = Get-Content 'src/services/sms/sms.service.js' -Raw -Encoding UTF8
$content = $content -replace 'async validatePhoneNumber\(phoneNumber\)', 'async validatePhoneNumber(_phoneNumber)'
[System.IO.File]::WriteAllText((Resolve-Path 'src/services/sms/sms.service.js').Path, $content, [System.Text.Encoding]::UTF8)
Write-Host "  ✅ sms.service.js (1 warning)"

# 14. Fix sse-manager.service.js - line 252 - unused 'shopId'
$content = Get-Content 'src/services/sse-manager.service.js' -Raw -Encoding UTF8
$content = $content -replace 'const shopId = req\.user\?\.shopId', 'const _shopId = req.user?.shopId'
[System.IO.File]::WriteAllText((Resolve-Path 'src/services/sse-manager.service.js').Path, $content, [System.Text.Encoding]::UTF8)
Write-Host "  ✅ sse-manager.service.js (1 warning)"

# 15. Fix recalculate-customer-due.js - line 11 - unused 'ObjectId'
$content = Get-Content 'src/utils/migrations/recalculate-customer-due.js' -Raw -Encoding UTF8
$content = $content -replace 'const \{ ObjectId \} = ', 'const { ObjectId: _ObjectId } = '
[System.IO.File]::WriteAllText((Resolve-Path 'src/utils/migrations/recalculate-customer-due.js').Path, $content, [System.Text.Encoding]::UTF8)
Write-Host "  ✅ recalculate-customer-due.js (1 warning)"

Write-Host "`nDone! All 22 warnings should be fixed."
