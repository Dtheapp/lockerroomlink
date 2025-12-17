$headers = @{
    "X-API-Key" = "brain_d0480bd8850b4f8982e7ad7c5d2957d4"
    "Content-Type" = "application/json"
}

$data = @{
    learnings = @(
        @{
            category = "react"
            title = "Never nest button inside button"
            pattern = "Use span with cursor-pointer and onClick instead of nesting buttons"
            example = "Replace inner button with: <span className='cursor-pointer' onClick={handler}>Text</span>"
            confidence = 100
        }
    )
    errors = @(
        @{
            category = "react"
            title = "Button cannot be descendant of button"
            symptom = "React hydration error: In HTML, button cannot be a descendant of button"
            rootCause = "Nested a clickable button element inside another button element"
            solution = "Replace inner button with span element, add cursor-pointer class and onClick handler"
            severity = "high"
        }
    )
}

$body = $data | ConvertTo-Json -Depth 5

try {
    $response = Invoke-RestMethod -Uri "https://genesis-brain-hive.netlify.app/api/sync/learnings" -Method POST -Headers $headers -Body $body
    Write-Host "SUCCESS: Learning synced to brain!" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
