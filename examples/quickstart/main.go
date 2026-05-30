package main

import (
	"fmt"
	"log"

	"github.com/wzhongyou/proximia/pkg/proximia"
)

func main() {
	db, err := proximia.NewVectorDatabase("./example.wal")
	if err != nil {
		log.Fatalf("failed to initialize database: %v", err)
	}
	defer db.Close()

	if err := db.CreateCollection("articles", proximia.Cosine); err != nil {
		log.Fatalf("create collection: %v", err)
	}

	docs := []*proximia.Document{
		{
			ID:     "a1",
			Vector: []float64{0.9, 0.1, 0.2},
			Metadata: map[string]interface{}{
				"category": "news",
				"source":   "site-a",
			},
		},
		{
			ID:     "a2",
			Vector: []float64{0.1, 0.8, 0.3},
			Metadata: map[string]interface{}{
				"category": "blog",
				"source":   "site-b",
			},
		},
		{
			ID:     "a3",
			Vector: []float64{0.75, 0.25, 0.0},
			Metadata: map[string]interface{}{
				"category": "news",
				"source":   "site-c",
			},
		},
	}

	for _, doc := range docs {
		if err := db.Upsert("articles", doc); err != nil {
			log.Fatalf("upsert doc %s: %v", doc.ID, err)
		}
	}

	query := []float64{0.8, 0.2, 0.1}
	filter := proximia.And(proximia.FieldEqual("category", "news"))

	results, err := db.Search("articles", query, 3, filter)
	if err != nil {
		log.Fatalf("search failed: %v", err)
	}

	fmt.Println("Search results for news articles:")
	for i, hit := range results {
		fmt.Printf("%d. id=%s score=%.4f metadata=%v\n", i+1, hit.ID, hit.Score, hit.Document.Metadata)
	}

	count, dim, metric, err := db.CollectionStats("articles")
	if err != nil {
		log.Fatalf("stats failed: %v", err)
	}
	fmt.Printf("collection=articles count=%d dimension=%d metric=%s\n", count, dim, metric)
}
