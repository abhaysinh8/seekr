# Recommendations

Seekr implements three complementary recommenders inside `packages/recommendation-core`.

Content-based recommendation tokenizes configured item fields, constructs sparse TF-IDF vectors, L2-normalizes them, and uses cosine similarity. Sparse maps avoid allocating a coordinate for every vocabulary term. A user's content profile is the weighted sum of vectors for interacted items.

Item-item collaborative filtering treats each item as a sparse vector of user interaction weights; user-user filtering treats each user as a sparse vector of items. Their cosine similarity identifies neighbors. Default event strengths are view 1, click 2, bookmark 3, like 4, and purchase 5, and callers may provide an explicit weight. Known items are excluded from user recommendations.

The hybrid recommender combines normalized content, collaborative, popularity, and optional recency signals with configured weights. Missing signals fall back gracefully; a cold user can receive popularity-based results. Explanations expose component contributions. Neighbor results are cached and invalidated when relevant items or interactions change.

Main endpoints are `POST /v1/interactions`, `GET /v1/recommend/items/:itemId`, `GET /v1/recommend/users/:userId`, and `GET /v1/recommend/popular`. Pass `indexId`, `limit`, and optionally `explain` in the query string.
