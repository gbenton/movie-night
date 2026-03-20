# Movie Availability Filter --- PRD

## Overview

Personal, mobile-first web tool to filter curated movie lists by
streaming availability.

## Core Use Case

User opens app and instantly sees what movies from their lists are
available on their services.

## Features

-   Import lists (plain text + JSON)
-   Service selection (localStorage)
-   Availability lookup (JustWatch, cached)
-   Default screen: last-used list, filtered
-   Toggle: show unavailable

## Non-Goals

No auth, no social, no tracking, no recommendations

## Data Model

Movie: title, year?, rank? List: id, name, ranked?, movies\[\]

## Success Criteria

User selects a movie in \<10 seconds
