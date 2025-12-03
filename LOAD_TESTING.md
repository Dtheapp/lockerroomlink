# Load Testing Guide for LockerRoom Link

This guide explains how to perform load testing on the application.

## Quick Start with Artillery

### Installation
```bash
npm install -g artillery
```

### Run Load Test
```bash
artillery run load-test.yml
```

## Load Test Configuration

Create a file called `load-test.yml`:

```yaml
config:
  target: "https://your-netlify-app.netlify.app"
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warm up"
    - duration: 120
      arrivalRate: 10
      name: "Ramp up"
    - duration: 60
      arrivalRate: 20
      name: "Peak load"
  defaults:
    headers:
      Content-Type: "application/json"

scenarios:
  - name: "Load home page"
    flow:
      - get:
          url: "/"
          expect:
            - statusCode: 200

  - name: "Load static assets"
    flow:
      - get:
          url: "/assets/index.js"
      - get:
          url: "/assets/index.css"
```

## Alternative: Using k6

### Installation
```bash
# Windows (with Chocolatey)
choco install k6

# Or download from https://k6.io/docs/getting-started/installation/
```

### k6 Script (load-test.js)
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 20 },   // Stay at 20 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be < 500ms
    http_req_failed: ['rate<0.01'],   // Less than 1% failure rate
  },
};

export default function () {
  const res = http.get('https://your-netlify-app.netlify.app/');
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
}
```

### Run k6
```bash
k6 run load-test.js
```

## Performance Benchmarks

Target metrics for production:
- **Response Time**: p95 < 500ms
- **Throughput**: > 100 requests/second
- **Error Rate**: < 1%
- **Time to First Byte**: < 200ms

## Lighthouse CI

For frontend performance testing, use Lighthouse CI (already configured):

```bash
npm install -g @lhci/cli
lhci autorun
```

## Firebase Load Considerations

Since this app uses Firebase Firestore, consider:
1. **Read/Write Limits**: Firestore has limits of 1 write/second per document
2. **Connection Limits**: Each client maintains a persistent connection
3. **Query Performance**: Use indexes for complex queries

### Testing Firebase
Use the Firebase Emulator Suite for load testing:
```bash
firebase emulators:start
```

## Recommended Testing Schedule

1. **Before major releases**: Full load test with peak traffic simulation
2. **Weekly**: Lightweight smoke tests
3. **After database changes**: Query performance tests

## Monitoring in Production

Use Netlify Analytics and Firebase Performance Monitoring to track:
- Page load times
- API response times
- Error rates
- User session duration
