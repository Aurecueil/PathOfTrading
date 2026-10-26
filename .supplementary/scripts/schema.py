import sys
import json
from collections import defaultdict

def get_type_name(value):
    """Maps Python types to descriptive JSON schema type names."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return "unknown"

def infer_schema(node):
    """Recursively infers schema and adds '?' to optional/sparse fields."""
    node_type = get_type_name(node)

    # Base primitive types
    if node_type not in ("object", "array"):
        return node_type

    # Single dictionary
    if node_type == "object":
        return {key: infer_schema(val) for key, val in node.items()}

    # Lists / Arrays
    if node_type == "array":
        if not node:
            return []

        # If array holds primitives rather than objects
        if not any(isinstance(item, dict) for item in node):
            unique_types = sorted(list({get_type_name(item) for item in node}))
            return [" | ".join(unique_types)]

        # Collect only dict entries to merge their structures
        dict_items = [item for item in node if isinstance(item, dict)]
        total_items = len(dict_items)

        key_counts = defaultdict(int)
        key_values = defaultdict(list)

        for item in dict_items:
            for k, v in item.items():
                key_counts[k] += 1
                key_values[k].append(v)

        merged_dict = {}
        for key, values in key_values.items():
            # Mark key with '?' if it doesn't appear in every object
            key_name = key if key_counts[key] == total_items else f"{key}?"

            types_in_values = {get_type_name(v) for v in values}

            # Homogeneous objects: merge them together
            if len(types_in_values) == 1 and "object" in types_in_values:
                merged_sub = infer_schema(values)
                merged_dict[key_name] = merged_sub[0] if isinstance(merged_sub, list) and merged_sub else merged_sub
            # Homogeneous arrays: flatten and infer element schema
            elif len(types_in_values) == 1 and "array" in types_in_values:
                flattened = [el for arr in values for el in arr]
                merged_dict[key_name] = infer_schema(flattened)
            else:
                # Deduplicate types/sub-schemas
                unique_schemas = []
                seen = set()
                for v in values:
                    sch = infer_schema(v)
                    sch_str = json.dumps(sch, sort_keys=True)
                    if sch_str not in seen:
                        seen.add(sch_str)
                        unique_schemas.append(sch)

                merged_dict[key_name] = unique_schemas[0] if len(unique_schemas) == 1 else unique_schemas

        return [merged_dict]

def main():
    if len(sys.argv) < 2:
        print("Usage: python get.py <path_to_json_file>")
        sys.exit(1)

    file_path = sys.argv[1]

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: File '{file_path}' not found.", file_error=True)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Failed to parse JSON: {e}")
        sys.exit(1)

    schema = infer_schema(data)
    print(json.dumps(schema, indent=4))

if __name__ == "__main__":
    main()