---
name: store-listing-audit
description: Guides ASO audit scoring for store listings. Analyzes on-metadata factors per store (title, subtitle, description, developer, category, tags, visuals) and scores each 1-100 based on PICKASO ASO Guide 2026 best practices.
---

# Store Listing Audit Skill

## Scoring Framework
Each on-metadata factor is scored 1-100 based on optimization level.

### App Store Factors
| Factor | Max Weight | What to Check |
|--------|-----------|---------------|
| App Name | 100 | 30 chars max, contains brand + primary keyword, no banned words |
| Subtitle | 100 | 30 chars max, contains secondary keywords not in title |
| Description | 100 | 4000 chars, CTA in first lines, structured with bullets, no keyword stuffing |
| Category | 100 | Best-fit primary + secondary category |
| Icon | 100 | Present, high quality, distinctive colors |
| Screenshots | 100 | Up to 10, storytelling flow, first 3 are critical, both orientations considered |
| Video Preview | 100 | Present, shows real app, first seconds impactful, max 30s |

### Google Play Factors
| Factor | Max Weight | What to Check |
|--------|-----------|---------------|
| Title | 100 | 30 chars max, brand + primary keyword, no performance claims |
| Short Description | 100 | 80 chars max, keywords present, compelling CTA |
| Long Description | 100 | 4000 chars, natural keyword density, HTML formatting, synonyms/antonyms |
| Developer Name | 100 | 50 chars max, keyword opportunity, brand trust |
| Category | 100 | Best-fit single category |
| Tags | 100 | All 5 tags used from available list |
| Icon | 100 | 1024x1024, bold colors, no text/rankings/promotions |
| Screenshots | 100 | Up to 8, vertical or horizontal, storytelling |
| Feature Graphic | 100 | 1024x500, present when video exists |
| Video | 100 | YouTube URL present, compelling content |

## Scoring Logic
- **Title length optimization**: score = (charsUsed / maxChars) * 50 + (hasKeyword ? 30 : 0) + (hasBrand ? 20 : 0)
- **Description quality**: score based on length ratio + keyword density (2-5% ideal) + structure (bullets, sections)
- **Visual completeness**: score based on count vs maximum + quality indicators
- **Overall**: weighted average of all factors

## Tips Generation
For each factor scoring below 70, generate actionable improvement tips based on PICKASO best practices.
