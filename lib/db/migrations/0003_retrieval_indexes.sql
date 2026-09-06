-- Retrieval indexes for code_chunks.
--
-- Both of these were added after measuring them; see eval/README.md.
--
-- 1. HNSW on the embedding column. Before this, every semantic search was an
--    exact sequential scan over every chunk in the repo. On a 12,290-chunk
--    repo that measured 153.9ms of server-side execution per query; with the
--    index it is 0.7ms, for a 0.009 drop in nDCG@10 from approximate search.
--
-- 2. A code-aware tsvector plus GIN index, backing keyword search. 'simple'
--    rather than 'english' because English stemming mangles identifiers
--    (routing -> rout) and its stopword list drops words that carry meaning in
--    code (in, not, on). The expression indexes the raw content so a whole
--    identifier matches, and a camel/snake-split copy so its parts match too.

CREATE INDEX IF NOT EXISTS "code_chunks_embedding_hnsw"
  ON "code_chunks" USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
--> statement-breakpoint
ALTER TABLE "code_chunks"
  ADD COLUMN IF NOT EXISTS "content_tsv" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(file_path, '') || ' ' ||
      regexp_replace(coalesce(file_path, ''), '[/._\-]', ' ', 'g') || ' ' ||
      content || ' ' ||
      regexp_replace(
        regexp_replace(
          regexp_replace(content, '([a-z0-9])([A-Z])', '\1 \2', 'g'),
          '([A-Z]+)([A-Z][a-z])', '\1 \2', 'g'
        ),
        '[_./:\-]', ' ', 'g'
      )
    )
  ) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_chunks_tsv_idx"
  ON "code_chunks" USING GIN ("content_tsv");
