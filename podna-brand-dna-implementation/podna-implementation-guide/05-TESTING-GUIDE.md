# 05: Testing Guide
## Comprehensive Testing Procedures

---

## Testing Strategy

### Test Pyramid
```
     /\
    /  \  E2E Tests (10%)
   /----\
  / Unit \ Integration Tests (30%)
 /  Tests \
/    60%   \ Unit Tests (60%)
------------
```

---

## 1. Unit Tests

### Backend Unit Tests

**File:** `src/services/__tests__/IntelligentPromptBuilder.test.js`

```javascript
const IntelligentPromptBuilder = require('../IntelligentPromptBuilder');

describe('IntelligentPromptBuilder', () => {
  describe('extractBrandDNA', () => {
    it('should extract brand DNA from valid profile', () => {
      const mockProfile = {
        aesthetic_themes: [
          { name: 'sporty-chic', strength: 0.67 }
        ],
        color_distribution: { navy: 0.35, white: 0.28 },
        fabric_distribution: { wool: 0.42, cotton: 0.31 },
        construction_patterns: [
          { name: 'princess seams', frequency: '67%' }
        ]
      };

      const brandDNA = IntelligentPromptBuilder.extractBrandDNA(mockProfile);

      expect(brandDNA).toBeDefined();
      expect(brandDNA.primaryAesthetic).toBe('sporty-chic');
      expect(brandDNA.signatureColors).toHaveLength(2);
      expect(brandDNA.signatureColors[0].name).toBe('navy');
    });

    it('should handle empty profile gracefully', () => {
      const brandDNA = IntelligentPromptBuilder.extractBrandDNA({});
      
      expect(brandDNA).toBeDefined();
      expect(brandDNA.primaryAesthetic).toBe('contemporary');
      expect(brandDNA.overallConfidence).toBeLessThan(0.6);
    });
  });

  describe('calculateBrandConsistency', () => {
    it('should calculate high score for matching attributes', () => {
      const selected = {
        styleContext: 'sporty-chic',
        colors: [{ name: 'navy' }, { name: 'white' }],
        fabric: { material: 'wool' }
      };

      const brandDNA = {
        primaryAesthetic: 'sporty-chic',
        signatureColors: [
          { name: 'navy', weight: 0.35 },
          { name: 'white', weight: 0.28 }
        ],
        signatureFabrics: [{ name: 'wool', weight: 0.42 }]
      };

      const score = IntelligentPromptBuilder.calculateBrandConsistency(selected, brandDNA);
      
      expect(score).toBeGreaterThan(0.8);
    });

    it('should calculate low score for mismatched attributes', () => {
      const selected = {
        styleContext: 'minimalist',
        colors: [{ name: 'red' }],
        fabric: { material: 'denim' }
      };

      const brandDNA = {
        primaryAesthetic: 'sporty-chic',
        signatureColors: [{ name: 'navy', weight: 0.35 }],
        signatureFabrics: [{ name: 'wool', weight: 0.42 }]
      };

      const score = IntelligentPromptBuilder.calculateBrandConsistency(selected, brandDNA);
      
      expect(score).toBeLessThan(0.5);
    });
  });

  describe('thompsonSampleWithBias', () => {
    it('should boost brand-preferred attributes', () => {
      const preferences = {
        navy: { count: 10, data: { name: 'navy' } },
        black: { count: 10, data: { name: 'black' } },
        red: { count: 10, data: { name: 'red' } }
      };

      const thompsonParams = {
        navy: { alpha: 10, beta: 2 },
        black: { alpha: 10, beta: 2 },
        red: { alpha: 10, beta: 2 }
      };

      const brandPreferences = ['navy'];

      // Sample 100 times, navy should win more often due to boost
      let navyWins = 0;
      for (let i = 0; i < 100; i++) {
        const selected = IntelligentPromptBuilder.thompsonSampleWithBias(
          preferences,
          thompsonParams,
          brandPreferences,
          false,
          1.5
        );
        if (selected.name === 'navy') navyWins++;
      }

      expect(navyWins).toBeGreaterThan(40); // Should win >40% with 1.5x boost
    });
  });
});
```

### Frontend Unit Tests

**File:** `frontend/src/pages/__tests__/Generation.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Generation from '../Generation';
import { BrowserRouter } from 'react-router-dom';

jest.mock('../../services/agentsAPI');

describe('Generation Page', () => {
  it('should display brand DNA when profile loaded', async () => {
    const mockProfile = {
      brandDNA: {
        primaryAesthetic: 'sporty-chic',
        signatureColors: [
          { name: 'navy', hex: '#1a2b4c', weight: 0.35 }
        ]
      }
    };

    // Mock API call
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { profile: mockProfile } })
    } as Response);

    render(
      <BrowserRouter>
        <Generation />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('sporty-chic')).toBeInTheDocument();
      expect(screen.getByText('navy')).toBeInTheDocument();
    });
  });

  it('should toggle brand DNA enforcement', async () => {
    render(
      <BrowserRouter>
        <Generation />
      </BrowserRouter>
    );

    const toggle = screen.getByRole('button', { name: /enable|disable/i });
    fireEvent.click(toggle);

    // Should show warning when disabled
    await waitFor(() => {
      expect(screen.getByText(/brand dna disabled/i)).toBeInTheDocument();
    });
  });

  it('should show brand consistency scores on images', async () => {
    const mockGenerations = [
      {
        id: 'gen-1',
        url: 'https://example.com/image.jpg',
        brandConsistencyScore: 0.89
      }
    ];

    // Render with mock data
    render(
      <BrowserRouter>
        <Generation />
      </BrowserRouter>
    );

    // Simulate generation complete
    // ... implementation

    await waitFor(() => {
      expect(screen.getByText('89% match')).toBeInTheDocument();
    });
  });
});
```

---

## 2. Integration Tests

### Backend Integration Tests

**File:** `src/routes/__tests__/generation.integration.test.js`

```javascript
const request = require('supertest');
const app = require('../../app');
const db = require('../../services/database');

describe('Generation API Integration', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    // Create test user and get token
    const response = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'test@podna.com',
        password: 'test123',
        name: 'Test User'
      });

    authToken = response.body.token;
    userId = response.body.user.id;

    // Upload test portfolio
    await request(app)
      .post('/api/podna/portfolio/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('portfolio', '__tests__/fixtures/test-portfolio.zip');

    // Wait for analysis
    await new Promise(resolve => setTimeout(resolve, 5000));
  });

  afterAll(async () => {
    // Cleanup test data
    await db.query('DELETE FROM users WHERE email = $1', ['test@podna.com']);
    await db.end();
  });

  describe('POST /api/podna/generate-with-dna', () => {
    it('should generate with brand DNA', async () => {
      const response = await request(app)
        .post('/api/podna/generate-with-dna')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          prompt: 'black blazer',
          enforceBrandDNA: true,
          brandDNAStrength: 0.8,
          count: 2
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.generations).toHaveLength(2);
      expect(response.body.data.generations[0]).toHaveProperty('brand_consistency_score');
      expect(response.body.data.brandDNA).toBeDefined();
      expect(response.body.data.avgBrandConsistency).toBeGreaterThan(0);
    });

    it('should return error when no profile exists', async () => {
      // Create new user without profile
      const newUser = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'noprofile@podna.com',
          password: 'test123',
          name: 'No Profile'
        });

      const response = await request(app)
        .post('/api/podna/generate-with-dna')
        .set('Authorization', `Bearer ${newUser.body.token}`)
        .send({
          prompt: 'black blazer',
          enforceBrandDNA: true
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('NO_STYLE_PROFILE');
    });
  });

  describe('GET /api/podna/profile', () => {
    it('should return profile with brand DNA', async () => {
      const response = await request(app)
        .get('/api/podna/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.profile).toBeDefined();
      expect(response.body.data.brandDNA).toBeDefined();
      expect(response.body.data.brandDNA.primaryAesthetic).toBeDefined();
      expect(response.body.data.brandDNA.signatureColors).toBeInstanceOf(Array);
    });
  });
});
```

---

## 3. End-to-End Tests

### Cypress E2E Tests

**File:** `cypress/e2e/brand-dna-generation.cy.ts`

```typescript
describe('Brand DNA Generation Flow', () => {
  beforeEach(() => {
    // Login
    cy.visit('/login');
    cy.get('[data-testid="email-input"]').type('test@podna.com');
    cy.get('[data-testid="password-input"]').type('test123');
    cy.get('[data-testid="login-button"]').click();
    
    // Wait for redirect
    cy.url().should('include', '/home');
  });

  it('should complete full generation flow with brand DNA', () => {
    // Navigate to generation page
    cy.visit('/generation');

    // Verify brand DNA is displayed
    cy.contains('Your Brand DNA').should('be.visible');
    cy.contains('sporty-chic').should('be.visible');

    // Enter prompt
    cy.get('[data-testid="prompt-input"]').type('black blazer');

    // Verify brand alignment updates
    cy.contains('Brand Alignment').should('be.visible');
    cy.get('[data-testid="brand-alignment-score"]').should('exist');

    // Generate
    cy.get('[data-testid="generate-button"]').click();

    // Wait for generation
    cy.contains('Generating...', { timeout: 30000 }).should('be.visible');

    // Verify results
    cy.get('[data-testid="generated-image"]', { timeout: 60000 })
      .should('have.length.at.least', 1);

    // Verify brand consistency badge
    cy.get('[data-testid="brand-consistency-badge"]')
      .first()
      .should('contain', '% match');
  });

  it('should allow toggling brand DNA', () => {
    cy.visit('/generation');

    // Toggle off
    cy.get('[data-testid="brand-dna-toggle"]').click();
    
    // Verify warning
    cy.contains('Brand DNA disabled').should('be.visible');

    // Generate without brand DNA
    cy.get('[data-testid="prompt-input"]').type('red dress');
    cy.get('[data-testid="generate-button"]').click();

    // Should still generate but with lower consistency
    cy.get('[data-testid="generated-image"]', { timeout: 60000 })
      .should('exist');
  });

  it('should navigate from profile to generation', () => {
    // Go to profile
    cy.visit('/style-profile');

    // Verify brand DNA section
    cy.contains('Your Brand DNA').should('be.visible');

    // Click "Generate from aesthetic"
    cy.contains('Generate sporty-chic designs').click();

    // Should navigate to generation with seed
    cy.url().should('include', '/generation');
    cy.get('[data-testid="prompt-input"]')
      .should('have.value', 'sporty-chic style design');
  });
});
```

---

## 4. Manual Testing Checklist

### Profile & Brand DNA Extraction
- [ ] Upload 20+ diverse portfolio images
- [ ] Verify analysis completes within 10 minutes
- [ ] Check profile shows aesthetic themes
- [ ] Verify brand DNA section appears
- [ ] Confirm signature colors are accurate
- [ ] Verify construction patterns match portfolio
- [ ] Check confidence scores are >70%

### Generation with Brand DNA
- [ ] Enter simple prompt ("black blazer")
- [ ] Verify brand alignment score shows
- [ ] Verify prompt enhancement includes brand elements
- [ ] Generate 4 images with brand DNA enabled
- [ ] Confirm 3/4 images have >70% consistency score
- [ ] Check generated images match brand aesthetic
- [ ] Verify brand consistency badge on each image

### Brand DNA Control
- [ ] Toggle brand DNA off
- [ ] Verify warning message appears
- [ ] Generate images without brand DNA
- [ ] Confirm consistency scores are lower
- [ ] Adjust brand strength slider
- [ ] Generate at different strength levels
- [ ] Verify strength impacts consistency

### Feedback Loop
- [ ] Like a generated image
- [ ] Verify feedback is recorded
- [ ] Generate new images
- [ ] Confirm Thompson parameters updated
- [ ] Dislike an image with critique
- [ ] Verify critique is parsed
- [ ] Generate again, check adjustments

### Profile to Generation Flow
- [ ] Click "Generate from aesthetic"
- [ ] Verify navigation to Generation page
- [ ] Check prompt is pre-filled
- [ ] Generate designs
- [ ] Confirm they match aesthetic

---

## 5. Performance Tests

### Load Testing with Artillery

**File:** `load-tests/generation-load.yml`

```yaml
config:
  target: "http://localhost:3001"
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100
      name: "Stress test"
  processor: "./auth-processor.js"

scenarios:
  - name: "Generate with Brand DNA"
    flow:
      - function: "authenticate"
      - post:
          url: "/api/podna/generate-with-dna"
          headers:
            Authorization: "Bearer {{ token }}"
          json:
            prompt: "black blazer"
            enforceBrandDNA: true
            count: 1
      - think: 5
```

**Run load test:**
```bash
artillery run load-tests/generation-load.yml
```

**Success criteria:**
- P95 latency <10s for generation
- Error rate <1%
- Throughput >50 req/s

---

## 6. Security Tests

### Authentication Tests
```bash
# Test without token
curl -X POST http://localhost:3001/api/podna/generate-with-dna \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}'

# Expected: 401 Unauthorized

# Test with invalid token
curl -X POST http://localhost:3001/api/podna/generate-with-dna \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}'

# Expected: 401 Unauthorized
```

### Input Validation Tests
```bash
# Test SQL injection
curl -X POST http://localhost:3001/api/podna/generate-with-dna \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test\"; DROP TABLE users; --"}'

# Expected: 200 with sanitized input

# Test XSS
curl -X POST http://localhost:3001/api/podna/generate-with-dna \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "<script>alert(1)</script>"}'

# Expected: 200 with escaped output
```

---

## 7. Regression Tests

### Critical Path Tests
Run before every deployment:

```bash
npm run test:critical-path
```

Tests must include:
1. Portfolio upload and analysis
2. Brand DNA extraction
3. Generation with brand DNA
4. Brand consistency scoring
5. Feedback processing

All must pass with >95% success rate.

---

## 8. Test Data

### Test Portfolio
**Location:** `/examples/test-portfolio.zip`

Contains 20 curated images representing:
- 8 blazers (sporty-chic)
- 6 dresses (various styles)
- 4 coats (structured)
- 2 pants (tailored)

Expected brand DNA:
- Primary: sporty-chic
- Colors: navy, white, camel
- Fabrics: wool, cotton
- Construction: princess seams, welt pockets

### Test User Credentials
```
Email: test@podna.com
Password: test123
```

Profile should be pre-generated with test portfolio.

---

## 9. Continuous Integration

### GitHub Actions Workflow

**File:** `.github/workflows/test.yml`

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## ✅ Testing Completion Checklist

- [ ] All unit tests pass (>80% coverage)
- [ ] All integration tests pass
- [ ] E2E critical path passes
- [ ] Manual testing checklist completed
- [ ] Load tests meet performance criteria
- [ ] Security tests show no vulnerabilities
- [ ] Regression tests pass
- [ ] CI/CD pipeline green

**Success Criteria:** All tests pass, coverage >80%, performance within targets.

---

**Next:** Read `06-DEPLOYMENT-CHECKLIST.md` for pre-launch verification.
