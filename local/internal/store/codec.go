package store

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
)

var identifier = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,80}$`)
var collections = []string{"blocks", "crew", "dividers", "excavations", "colorLegend"}

func put(c cells, k key, value any) error {
	b, err := json.Marshal(value)
	if err == nil {
		c[k] = string(b)
	}
	return err
}

// A field is a record, so independent edits don't replace a JSON board. Set
// memberships also get independent records instead of sharing an array cell.
func flatten(p Project) (cells, error) {
	if err := Validate(p); err != nil {
		return nil, err
	}
	c := cells{}
	for _, field := range []string{"version", "layoutVersion", "name", "subtitle", "maxPlacements"} {
		if v, ok := p[field]; ok {
			if err := put(c, key{"project", "board", field}, v); err != nil {
				return nil, err
			}
		}
	}
	for _, kind := range collections {
		entities := map[string]map[string]any{}
		positions := map[string]int{}
		if kind == "colorLegend" {
			if legend, ok := p[kind].(map[string]any); ok {
				for id, value := range legend {
					entities[id] = value.(map[string]any)
				}
			}
		} else if list, ok := p[kind].([]any); ok {
			for i, value := range list {
				entity := value.(map[string]any)
				id, _ := entity["id"].(string)
				if kind == "excavations" {
					id, _ = entity["blockId"].(string)
					if id == "" {
						id = fmt.Sprintf("ground:%v:%v:%v:%v", entity["x"], entity["y"], entity["width"], entity["height"])
					}
				}
				if _, exists := entities[id]; exists {
					return nil, fmt.Errorf("duplicate %s ID", kind)
				}
				entities[id] = entity
				positions[id] = i
			}
		}
		for id, entity := range entities {
			if err := put(c, key{kind, id, "$position"}, positions[id]); err != nil {
				return nil, err
			}
			for field, value := range entity {
				if kind == "blocks" && (field == "people" || field == "dependencies") {
					if err := put(c, key{kind, id, field}, true); err != nil {
						return nil, err
					} // Retain empty arrays.
					for i, member := range value.([]any) {
						if err := put(c, key{field, id, member.(string)}, i); err != nil {
							return nil, err
						}
					}
				} else if err := put(c, key{kind, id, field}, value); err != nil {
					return nil, err
				}
			}
		}
	}
	return c, nil
}

func expand(c cells) (Project, error) {
	if len(c) == 0 {
		return nil, nil
	}
	p := Project{"selected": nil}
	entities := map[string]map[string]map[string]any{}
	for _, kind := range collections {
		entities[kind] = map[string]map[string]any{}
	}
	positions := map[key]float64{}
	members := map[key]map[string]float64{}
	for k, raw := range c {
		var v any
		if err := json.Unmarshal([]byte(raw), &v); err != nil {
			return nil, err
		}
		if k.Kind == "project" {
			p[k.Field] = v
			continue
		}
		if k.Kind == "people" || k.Kind == "dependencies" {
			mk := key{k.Kind, k.Entity, ""}
			if members[mk] == nil {
				members[mk] = map[string]float64{}
			}
			position, ok := v.(float64)
			if !ok {
				return nil, fmt.Errorf("invalid relationship position")
			}
			members[mk][k.Field] = position
			continue
		}
		bucket, exists := entities[k.Kind]
		if !exists {
			return nil, fmt.Errorf("unknown database record %q", k.Kind)
		}
		if bucket[k.Entity] == nil {
			bucket[k.Entity] = map[string]any{}
		}
		if k.Field == "$position" {
			position, ok := v.(float64)
			if !ok {
				return nil, fmt.Errorf("invalid entity position")
			}
			positions[key{k.Kind, k.Entity, ""}] = position
		} else {
			bucket[k.Entity][k.Field] = v
		}
	}
	for _, kind := range collections {
		bucket := entities[kind]
		if kind == "colorLegend" {
			legend := map[string]any{}
			for id, entity := range bucket {
				legend[id] = entity
			}
			p[kind] = legend
			continue
		}
		ids := make([]string, 0, len(bucket))
		for id := range bucket {
			ids = append(ids, id)
		}
		sort.Slice(ids, func(i, j int) bool {
			a, b := positions[key{kind, ids[i], ""}], positions[key{kind, ids[j], ""}]
			if a == b {
				return ids[i] < ids[j]
			}
			return a < b
		})
		list := []any{}
		for _, id := range ids {
			entity := bucket[id]
			if kind == "blocks" {
				for _, field := range []string{"people", "dependencies"} {
					if _, exists := entity[field]; !exists {
						continue
					}
					membership := members[key{field, id, ""}]
					values := []string{}
					for member := range membership {
						values = append(values, member)
					}
					sort.Slice(values, func(i, j int) bool {
						a, b := membership[values[i]], membership[values[j]]
						if a == b {
							return values[i] < values[j]
						}
						return a < b
					})
					array := []any{}
					for _, member := range values {
						array = append(array, member)
					}
					entity[field] = array
				}
			}
			list = append(list, entity)
		}
		p[kind] = list
	}
	if err := Validate(p); err != nil {
		return nil, fmt.Errorf("invalid saved board: %w", err)
	}
	return p, nil
}

// Validate the storage envelope before any SQL mutation. The browser additionally
// validates domain rules and recomputes masonry with the existing project model.
func Validate(p Project) error {
	if p == nil || p["version"] != float64(1) || p["layoutVersion"] != float64(3) {
		return fmt.Errorf("unsupported project version")
	}
	allowed := map[string]bool{}
	for _, f := range append(collections, "version", "layoutVersion", "name", "subtitle", "maxPlacements", "selected") {
		allowed[f] = true
	}
	for f := range p {
		if !allowed[f] {
			return fmt.Errorf("unknown project field %q", f)
		}
	}
	for _, f := range []string{"name", "subtitle"} {
		if v, ok := p[f]; ok {
			if str, ok := v.(string); !ok || len([]rune(str)) > 80 {
				return fmt.Errorf("invalid %s", f)
			}
		}
	}
	for _, kind := range collections {
		if kind == "colorLegend" {
			legend, ok := p[kind].(map[string]any)
			if !ok || len(legend) > 16 {
				return fmt.Errorf("invalid color legend")
			}
			for id, value := range legend {
				if !identifier.MatchString(id) {
					return fmt.Errorf("invalid color ID")
				}
				if _, ok := value.(map[string]any); !ok {
					return fmt.Errorf("invalid color")
				}
			}
			continue
		}
		list, ok := p[kind].([]any)
		if !ok || len(list) > 10000 {
			return fmt.Errorf("invalid %s collection", kind)
		}
		seen := map[string]bool{}
		for _, value := range list {
			entity, ok := value.(map[string]any)
			if !ok || len(entity) > 80 {
				return fmt.Errorf("invalid %s entity", kind)
			}
			if kind != "excavations" {
				id, ok := entity["id"].(string)
				if !ok || !identifier.MatchString(id) || seen[id] {
					return fmt.Errorf("invalid or duplicate %s ID", kind)
				}
				seen[id] = true
			}
			for f := range entity {
				if len(f) > 80 || len(f) == 0 || f[0] == '$' {
					return fmt.Errorf("invalid field name")
				}
			}
			if kind == "blocks" {
				for _, f := range []string{"people", "dependencies"} {
					v, exists := entity[f]
					if !exists && f == "dependencies" {
						continue
					}
					members, ok := v.([]any)
					if !ok {
						return fmt.Errorf("invalid %s", f)
					}
					seen := map[string]bool{}
					for _, member := range members {
						id, ok := member.(string)
						if !ok || !identifier.MatchString(id) || seen[id] {
							return fmt.Errorf("invalid %s membership", f)
						}
						seen[id] = true
					}
				}
			}
		}
	}
	return nil
}
