#!/usr/bin/env python3
"""
Genesis AI Dev OS - App Store Review Scraper
Scrapes reviews from Apple App Store for competitor analysis.
"""

import json
import urllib.request
import urllib.parse
from datetime import datetime
import argparse

def scrape_apple_reviews(app_id: str, country: str = "us", count: int = 50):
    """Scrape reviews from Apple App Store."""
    url = f"https://itunes.apple.com/{country}/rss/customerreviews/id={app_id}/sortBy=mostRecent/json"
    
    try:
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            
        entries = data.get("feed", {}).get("entry", [])
        
        reviews = []
        for entry in entries[:count]:
            if isinstance(entry, dict) and "content" in entry:
                reviews.append({
                    "rating": int(entry.get("im:rating", {}).get("label", 0)),
                    "title": entry.get("title", {}).get("label", ""),
                    "content": entry.get("content", {}).get("label", ""),
                    "author": entry.get("author", {}).get("name", {}).get("label", ""),
                    "version": entry.get("im:version", {}).get("label", ""),
                })
        
        return reviews
    except Exception as e:
        print(f"Error scraping reviews: {e}")
        return []

def analyze_reviews(reviews: list):
    """Analyze reviews for common themes."""
    analysis = {
        "total_reviews": len(reviews),
        "average_rating": 0,
        "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
        "common_complaints": [],
        "common_praises": [],
        "feature_requests": []
    }
    
    if not reviews:
        return analysis
    
    # Calculate ratings
    total_rating = 0
    for review in reviews:
        rating = review.get("rating", 0)
        total_rating += rating
        if rating in analysis["rating_distribution"]:
            analysis["rating_distribution"][rating] += 1
    
    analysis["average_rating"] = round(total_rating / len(reviews), 2)
    
    # Common complaint keywords
    complaint_keywords = ["slow", "crash", "bug", "expensive", "confusing", "difficult", "broken", "poor", "terrible", "worst"]
    praise_keywords = ["love", "great", "amazing", "easy", "best", "perfect", "excellent", "awesome"]
    feature_keywords = ["wish", "would be nice", "please add", "need", "should have", "missing"]
    
    complaints = []
    praises = []
    features = []
    
    for review in reviews:
        content = (review.get("content", "") + " " + review.get("title", "")).lower()
        
        for keyword in complaint_keywords:
            if keyword in content and review.get("rating", 5) <= 3:
                complaints.append(review.get("content", "")[:200])
                break
        
        for keyword in praise_keywords:
            if keyword in content and review.get("rating", 0) >= 4:
                praises.append(review.get("content", "")[:200])
                break
        
        for keyword in feature_keywords:
            if keyword in content:
                features.append(review.get("content", "")[:200])
                break
    
    analysis["common_complaints"] = complaints[:10]
    analysis["common_praises"] = praises[:10]
    analysis["feature_requests"] = features[:10]
    
    return analysis

# App IDs for competitors
COMPETITOR_APPS = {
    "teamsnap": "393048976",
    "gamechanger": "476016817",
    "sportsengine": "521594269"
}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape app store reviews")
    parser.add_argument("--app", type=str, help="App name (teamsnap, gamechanger, sportsengine) or Apple App ID")
    parser.add_argument("--count", type=int, default=50, help="Number of reviews to fetch")
    parser.add_argument("--output", type=str, help="Output JSON file path")
    
    args = parser.parse_args()
    
    # Get app ID
    app_id = COMPETITOR_APPS.get(args.app.lower(), args.app) if args.app else COMPETITOR_APPS["teamsnap"]
    
    print(f"Scraping reviews for app ID: {app_id}")
    reviews = scrape_apple_reviews(app_id, count=args.count)
    
    print(f"Found {len(reviews)} reviews")
    analysis = analyze_reviews(reviews)
    
    result = {
        "scraped_at": datetime.now().isoformat(),
        "app_id": app_id,
        "reviews": reviews,
        "analysis": analysis
    }
    
    if args.output:
        with open(args.output, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Results saved to {args.output}")
    else:
        print(json.dumps(analysis, indent=2))
