#!/usr/bin/env python3
"""
Genesis AI Dev OS - Competitor Pricing Scraper
Scrapes pricing pages from competitor websites.

Note: This is a basic scraper. For production use, consider:
- Using Playwright for JavaScript-rendered pages
- Adding proxy rotation
- Respecting robots.txt
"""

import json
import urllib.request
from datetime import datetime
from html.parser import HTMLParser
import argparse
import re

class PricingParser(HTMLParser):
    """Simple HTML parser to extract pricing information."""
    
    def __init__(self):
        super().__init__()
        self.in_price = False
        self.prices = []
        self.current_text = ""
        
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        class_name = attrs_dict.get("class", "")
        
        # Look for common pricing class names
        if any(keyword in class_name.lower() for keyword in ["price", "cost", "amount", "plan", "tier"]):
            self.in_price = True
            
    def handle_endtag(self, tag):
        if self.in_price and self.current_text.strip():
            self.prices.append(self.current_text.strip())
        self.in_price = False
        self.current_text = ""
        
    def handle_data(self, data):
        if self.in_price:
            self.current_text += data

def scrape_pricing_page(url: str):
    """Scrape a pricing page for price information."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            html = response.read().decode("utf-8", errors="ignore")
        
        # Parse HTML for pricing
        parser = PricingParser()
        parser.feed(html)
        
        # Also find prices with regex
        price_patterns = [
            r'\$\d+(?:\.\d{2})?(?:/mo(?:nth)?)?',
            r'\$\d+(?:\.\d{2})?\s*(?:per|/)\s*(?:month|year|team|user)',
            r'(?:free|Free|FREE)',
        ]
        
        regex_prices = []
        for pattern in price_patterns:
            matches = re.findall(pattern, html, re.IGNORECASE)
            regex_prices.extend(matches)
        
        # Combine and deduplicate
        all_prices = list(set(parser.prices + regex_prices))
        
        return {
            "url": url,
            "prices_found": all_prices,
            "raw_html_length": len(html),
            "success": True
        }
        
    except Exception as e:
        return {
            "url": url,
            "prices_found": [],
            "error": str(e),
            "success": False
        }

# Competitor pricing pages
COMPETITOR_URLS = {
    "teamsnap": "https://www.teamsnap.com/pricing",
    "sportsengine": "https://www.sportsengine.com/solutions/team-management",
    "gamechanger": "https://gc.com/pricing"
}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape competitor pricing pages")
    parser.add_argument("--url", type=str, help="Direct URL to scrape")
    parser.add_argument("--competitor", type=str, help="Competitor name (teamsnap, sportsengine, gamechanger)")
    parser.add_argument("--all", action="store_true", help="Scrape all known competitors")
    parser.add_argument("--output", type=str, help="Output JSON file path")
    
    args = parser.parse_args()
    
    results = []
    
    if args.all:
        print("Scraping all competitors...")
        for name, url in COMPETITOR_URLS.items():
            print(f"  Scraping {name}...")
            result = scrape_pricing_page(url)
            result["competitor"] = name
            results.append(result)
    elif args.url:
        print(f"Scraping {args.url}...")
        results.append(scrape_pricing_page(args.url))
    elif args.competitor:
        url = COMPETITOR_URLS.get(args.competitor.lower())
        if url:
            print(f"Scraping {args.competitor}...")
            result = scrape_pricing_page(url)
            result["competitor"] = args.competitor
            results.append(result)
        else:
            print(f"Unknown competitor: {args.competitor}")
            print(f"Available: {', '.join(COMPETITOR_URLS.keys())}")
    else:
        print("Please specify --url, --competitor, or --all")
        exit(1)
    
    output = {
        "scraped_at": datetime.now().isoformat(),
        "results": results
    }
    
    if args.output:
        with open(args.output, "w") as f:
            json.dump(output, f, indent=2)
        print(f"Results saved to {args.output}")
    else:
        print(json.dumps(output, indent=2))
