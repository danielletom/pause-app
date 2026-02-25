# Claude Code Coworker Instructions: Insights Pipeline UI Updates

## Context

The Pause API now has a multi-agent insights pipeline that runs nightly. It produces AI-enriched data that the API already serves, but the Expo React Native frontend doesn't fully consume it yet. These instructions describe the UI changes needed.

**API base URL:** `https://pause-api-seven.vercel.app`

---

## Task 1: Fix "pp" → "%" in insights.tsx (4 locations)

**File:** `app/(app)/(tabs)/insights.tsx`

The API already returns `%` but the frontend still hardcodes `pp` (percentage points). Change these 4 lines:

1. **Line ~369** — "Looking ahead" text:
   ```
   BEFORE: `${pct}pp. Worth trying this week.`
   AFTER:  `${pct}%. Worth trying this week.`
   ```

2. **Line ~1002** — Correlation cards (arrow label):
   ```
   BEFORE: {c.direction === 'negative' ? `↓${pct}pp` : `↑${pct}pp`}
   AFTER:  {c.direction === 'negative' ? `↓${pct}%` : `↑${pct}%`}
   ```

3. **Line ~1087** — Helps side (percentage display):
   ```
   BEFORE: {h.pct}pp
   AFTER:  {h.pct}%
   ```

4. **Line ~1104** — Hurts side (percentage display):
   ```
   BEFORE: {h.pct}pp
   AFTER:  {h.pct}%
   ```

---

## Task 2: Use Pipeline's AI-Enriched helpsHurts from API

**File:** `app/(app)/(tabs)/insights.tsx`

Currently, the frontend computes `helpsHurts` locally from raw correlations (lines ~318-349, the `useMemo` block). The API now returns an optional `helpsHurts` field from the naturopath pipeline with AI-written explanations.

### What the API returns (GET /api/insights/correlations)

When pipeline data is available, the response includes:

```json
{
  "correlations": [...],
  "helpsHurts": {
    "helps": [
      {
        "factor": "exercised",
        "symptom": "mood_changes",
        "explanation": "Exercise releases endorphins and helps regulate estrogen fluctuations...",
        "strength": 35
      }
    ],
    "hurts": [
      {
        "factor": "alcohol",
        "symptom": "hot_flashes",
        "explanation": "Alcohol causes vasodilation which directly triggers hot flashes...",
        "strength": 36
      }
    ]
  },
  "contradictions": [...]
}
```

### What to change

1. Update the `CorrelationsResponse` interface (around line 55) to include optional fields:

```typescript
interface CorrelationsResponse {
  correlations: CorrelationItem[];
  lastComputed: string | null;
  dataQuality: 'building' | 'moderate' | 'strong';
  totalFound: number;
  // Pipeline enrichments (optional — present when AI pipeline has run)
  helpsHurts?: {
    helps: { factor: string; symptom: string; explanation: string; strength: number }[];
    hurts: { factor: string; symptom: string; explanation: string; strength: number }[];
  };
  contradictions?: {
    factor: string;
    helpsSymptom: string;
    hurtsSymptom: string;
    explanation: string;
  }[];
}
```

2. Store `helpsHurts` and `contradictions` from the API response in state.

3. Update the `helpsHurts` useMemo to prefer the API's pipeline data when available, falling back to the current local computation:

```typescript
const helpsHurts = useMemo(() => {
  // Prefer AI-enriched pipeline data when available
  if (pipelineHelpsHurts) {
    return {
      helps: pipelineHelpsHurts.helps.map(h => ({
        label: `${formatSymptomName(h.factor)} → ${formatSymptomName(h.symptom).toLowerCase()}`,
        pct: Math.round(h.strength),
        key: `${h.factor}_${h.symptom}`,
        explanation: h.explanation,
      })).slice(0, 4),
      hurts: pipelineHelpsHurts.hurts.map(h => ({
        label: `${formatSymptomName(h.factor)} → ${formatSymptomName(h.symptom).toLowerCase()}`,
        pct: Math.round(h.strength),
        key: `${h.factor}_${h.symptom}`,
        explanation: h.explanation,
      })).slice(0, 4),
    };
  }
  // ...existing local computation as fallback...
}, [correlations, pipelineHelpsHurts]);
```

4. Optionally, show the AI `explanation` text below each helps/hurts bar. Add a small subtitle line under the bar in each `hhItem`:

```tsx
<Text style={{ fontSize: 12, color: '#78716c', marginTop: 2 }} numberOfLines={2}>
  {h.explanation}
</Text>
```

---

## Task 3: Show AI Explanation on Correlation Cards

**File:** `app/(app)/(tabs)/insights.tsx`

The API now returns optional `explanation`, `mechanism`, `recommendation`, and `caveat` fields on each correlation.

### Update CorrelationItem interface

```typescript
interface CorrelationItem {
  factor: string;
  symptom: string;
  direction: 'positive' | 'negative';
  confidence: number;
  effectSizePct: number;
  occurrences: number;
  lagDays: number;
  humanLabel: string;
  // Pipeline enrichments (optional)
  explanation?: string;
  recommendation?: string;
  mechanism?: string;
  caveat?: string;
}
```

### Add explanation below each correlation card

In the correlations `.map()` block (around line ~987-1011), add below the confidence line:

```tsx
{c.explanation && (
  <Text style={{ fontSize: 13, color: '#44403c', marginTop: 4, lineHeight: 18 }}>
    {c.explanation}
  </Text>
)}
{c.recommendation && (
  <Text style={{ fontSize: 12, color: '#047857', marginTop: 4, fontStyle: 'italic' }}>
    💡 {c.recommendation}
  </Text>
)}
{c.caveat && (
  <Text style={{ fontSize: 12, color: '#78716c', marginTop: 2, fontStyle: 'italic' }}>
    ⚠️ {c.caveat}
  </Text>
)}
```

---

## Task 4: Add Contradictions Section

**File:** `app/(app)/(tabs)/insights.tsx`

Add a new section after "What helps vs. what hurts" (after line ~1116) when contradictions exist.

### Contradictions data shape (from API)

```json
{
  "contradictions": [
    {
      "factor": "med_Magnesium Glycinate",
      "helpsSymptom": "anxiety",
      "hurtsSymptom": "night sweats",
      "explanation": "Magnesium calms anxiety but can cause GI disturbance leading to night sweats. Try taking it earlier in the evening."
    }
  ]
}
```

### UI to add

```tsx
{contradictions && contradictions.length > 0 && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Things that cut both ways</Text>
    <View style={{ gap: 8 }}>
      {contradictions.map((c, i) => (
        <View key={i} style={{
          backgroundColor: '#fefce8',
          borderRadius: 12,
          padding: 14,
          borderWidth: 1,
          borderColor: '#fde68a',
        }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#92400e', marginBottom: 4 }}>
            {formatSymptomName(c.factor)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: '#047857' }}>✓</Text>
              <Text style={{ fontSize: 13, color: '#44403c' }}>
                Helps {c.helpsSymptom.replace(/_/g, ' ')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: '#dc2626' }}>✗</Text>
              <Text style={{ fontSize: 13, color: '#44403c' }}>
                Hurts {c.hurtsSymptom.replace(/_/g, ' ')}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, color: '#78716c', lineHeight: 18 }}>
            {c.explanation}
          </Text>
        </View>
      ))}
    </View>
  </View>
)}
```

Style: warm yellow card (`#fefce8` background, `#fde68a` border) to indicate "mixed signal" — not good or bad, just nuanced.

---

## Task 5: Add Tomorrow's Forecast to Home Screen

**File:** `app/(app)/(tabs)/index.tsx`

The API already returns `tomorrowForecast` as a string in the home response, but the home screen doesn't render it.

### What the API returns (GET /api/insights/home)

```json
{
  "readiness": 62,
  "recommendation": "Your 7 hours of sleep is helping...",
  "tomorrowForecast": "If you sleep well tonight, tomorrow could be even better.",
  "insightNudge": { "title": "Pattern detected", "body": "..." },
  ...
}
```

### What to add

1. Store `tomorrowForecast` from the API response (it's already in the `HomeResponse` interface on line 51).

2. Add a forecast card after the insight nudge card (after line ~967) and before "Today's journal":

```tsx
{tomorrowForecast && (
  <View style={{
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  }}>
    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e40af', marginBottom: 4 }}>
      🔮 Looking ahead
    </Text>
    <Text style={{ fontSize: 14, color: '#1e3a5f', lineHeight: 20 }}>
      {tomorrowForecast}
    </Text>
  </View>
)}
```

Style: soft blue card to suggest forward-looking/predictive — distinct from the purple insight nudge.

---

## Task 6: Use Pipeline weeklyStory on Insights Screen

**File:** `app/(app)/(tabs)/insights.tsx`

Currently, `weeklyStory` is computed locally from logs via `computeWeeklyStory(logs)` (line ~351). The pipeline produces an AI-written `weeklyStory` that's richer and more personalised.

### What the API returns

The home endpoint (`GET /api/insights/home`) already returns `weeklyStory` (if available from pipeline) as part of the response. But the insights screen fetches from `/api/insights/correlations` which doesn't include it.

**Two options:**

**Option A (simplest):** Add `weeklyStory` to the correlations API response. In `pause-api/src/app/api/insights/correlations/route.ts`, add:

```typescript
if (pipelineInsight) {
  // Already doing this for helpsHurts and contradictions
  // Add weeklyStory:
  response.weeklyStory = pipelineRows[0]?.weeklyStory ?? null;
}
```

Wait — the correlations route doesn't have `weeklyStory` in its select. You'd need to add it.

**Option B (no API change):** Fetch `/api/insights/home` from the insights screen too (it already has all the data). Fetch it alongside correlations.

**Recommended: Option A** — add `weeklyStory` to the correlations response from the `interpretedInsights` table.

### Frontend change

In insights.tsx, prefer the AI weekly story when available, fall through to the local `computeWeeklyStory`:

```typescript
const displayStory = pipelineWeeklyStory || weeklyStory?.narrative;
```

Then render it in the "YOUR STORY" card (line ~952-970):

```tsx
{(displayStory || weeklyStory?.narrative) ? (
  <View style={styles.storyCard}>
    <Text style={styles.storyLabel}>YOUR STORY</Text>
    <Text style={styles.storyNarrative}>{displayStory || weeklyStory.narrative}</Text>
    {/* Keep bestDay/worstDay from local computation */}
    {weeklyStory?.bestDay && weeklyStory?.worstDay && (
      // ...existing best/worst day cards...
    )}
  </View>
) : null}
```

---

## Task 7: Add Symptom Guidance to Symptom Detail Screen

**File:** `app/(app)/symptom-detail.tsx`

Currently uses hardcoded `RECOMMENDATIONS` and `BENCHMARKS` objects (lines ~18-39). The pipeline produces personalised `symptomGuidance` per symptom.

### What the API returns

Add a new field to the correlations API or create a dedicated endpoint. The pipeline stores `symptomGuidanceJson` in `interpretedInsights`:

```json
{
  "night_sweats": {
    "explanation": "Your night sweats are linked to magnesium and alcohol intake...",
    "recommendations": [
      "Try moving magnesium to earlier in the evening",
      "Track alcohol-free evenings to see the impact"
    ],
    "relatedFactors": ["med_Magnesium Glycinate", "alcohol"]
  }
}
```

### What to change

1. Fetch symptom guidance from API (e.g., add to correlations response, or create `GET /api/insights/symptom-guidance?symptom=night_sweats`)

2. In `symptom-detail.tsx`, prefer personalised guidance when available:

```typescript
const recs = personalGuidance?.recommendations || RECOMMENDATIONS[symptomKey] || [];
const explanation = personalGuidance?.explanation;
```

3. Show the personalised explanation above the recommendations list:

```tsx
{explanation && (
  <View style={{ backgroundColor: '#f5f3ff', borderRadius: 12, padding: 12, marginBottom: 12 }}>
    <Text style={{ fontSize: 14, color: '#44403c', lineHeight: 20 }}>
      {explanation}
    </Text>
  </View>
)}
```

---

## Design Guidelines

- **Colour palette** (match existing app):
  - Green (helps/positive): `#047857` text, `#059669` bars
  - Red (hurts/negative): `#dc2626`
  - Warm yellow (contradictions): `#fefce8` bg, `#fde68a` border, `#92400e` text
  - Soft blue (forecast): `#eff6ff` bg, `#bfdbfe` border, `#1e40af` text
  - Purple (insight nudge — existing): `#f5f3ff` bg
  - Neutral text: `#44403c` body, `#78716c` muted

- **Typography**: Use existing styles where possible (`styles.sectionTitle`, `styles.correlationCard`, etc.)

- **Graceful degradation**: All pipeline fields are optional. If `explanation` is undefined, simply don't render it. If `contradictions` is empty, don't show the section. The app must work identically when pipeline data isn't available.

- **Animation**: Wrap tappable items in `AnimatedPressable` (already imported). Use `hapticLight()` on press.

---

## Testing

1. Test user: `emma@pausetest.com` — has full pipeline data
2. All pipeline surfaces should show for this user
3. For users without pipeline data, verify the app falls back gracefully to the existing local computations
4. Check that no "pp" text appears anywhere in the app
