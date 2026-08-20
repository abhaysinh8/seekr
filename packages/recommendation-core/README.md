# @seekr/recommendation-core

Framework-neutral recommendation algorithms implemented inside Seekr. The package provides weighted interaction storage and popularity, sparse TF-IDF content similarity, cached item-item collaborative filtering, and normalized hybrid scoring. It has no hosted recommendation, embedding, or machine-learning API dependency.

Collaborative neighbor construction costs `O(sum(k_u²))` for `k_u` distinct items per user and is cached until interactions change. Recommendation reads traverse neighbors of the target user's items instead of recomputing a full item matrix. Content index construction is linear in corpus tokens; sparse cosine work is proportional to non-zero overlapping features.
