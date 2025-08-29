#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convert combined_map_data.csv -> data.json
Usage:
  python csv_to_json.py input.csv output.json
"""
import sys, json
import pandas as pd
from pathlib import Path

def nz(x):
    return None if (pd.isna(x) or (isinstance(x, float) and pd.isna(x))) else x

def split_resources(val):
    if pd.isna(val):
        return []
    parts = []
    for token in str(val).replace(",", ";").split(";"):
        t = token.strip()
        if t:
            parts.append(t)
    return parts

def to_native(obj):
    if isinstance(obj, dict):
        return {k: to_native(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [to_native(v) for v in obj]
    elif pd.isna(obj):
        return None
    elif hasattr(obj, 'item'):
        try:
            return obj.item()
        except Exception:
            return obj
    return obj

def convert(csv_path, out_path):
    df = pd.read_csv(csv_path)
    galaxies = []
    for g_id, g_df in df.groupby('galaxy_id', dropna=False):
        g_df = g_df.copy()
        g_name = g_df['galaxy_name'].iloc[0]
        systems = []
        for s_id, s_df in g_df.groupby('system_id', dropna=False):
            s_df = s_df.copy()
            sys_row = s_df.iloc[0]
            system = {
                "id": nz(sys_row['system_id']),
                "name": nz(sys_row['system_name']),
                "control": nz(sys_row.get('system_control')),
                "type": nz(sys_row.get('system_type')),
                "color": nz(sys_row.get('system_color')),
                "size": nz(sys_row.get('system_size')),
                "x": float(sys_row.get('system_x')) if not pd.isna(sys_row.get('system_x')) else None,
                "y": float(sys_row.get('system_y')) if not pd.isna(sys_row.get('system_y')) else None,
                "z": float(sys_row.get('system_z')) if not pd.isna(sys_row.get('system_z')) else None,
                "planets": [],
                "stations": [],
                "asteroidBelts": []
            }
            # Planets
            p_df = s_df[s_df['object_type'] == 'planet']
            for _, r in p_df.iterrows():
                system["planets"].append({
                    "id": nz(r['planet_id']),
                    "name": nz(r['planet_name']),
                    "image": nz(r['planet_image']),
                    "distance": nz(r['planet_distance']),
                    "category": nz(r['planet_category']),
                    "race": nz(r['planet_race']),
                    "economics": nz(r['planet_economics']),
                    "politics": nz(r['planet_politics']),
                    "population": nz(r['planet_population']),
                    "level": int(r['planet_level']) if not pd.isna(r['planet_level']) else None,
                    "attitude": nz(r['planet_attitude']),
                    "terrain": nz(r['planet_terrain']),
                    "hills": nz(r['planet_hills']),
                    "oceans": nz(r['planet_oceans']),
                    "plains": nz(r['planet_plains']),
                    "resources": split_resources(r['planet_resources']),
                    "base": nz(r['planet_base'])
                })
            # Stations
            t_df = s_df[s_df['object_type'] == 'station']
            for _, r in t_df.iterrows():
                system["stations"].append({
                    "id": nz(r['station_id']),
                    "name": nz(r['station_name']),
                    "type": nz(r['station_type']),
                    "image": nz(r['station_image']),
                    "race": nz(r['station_race']),
                    "level": int(r['station_level']) if not pd.isna(r['station_level']) else None,
                    "attitude": nz(r['station_attitude']),
                    "position": {
                        "x": float(r['station_position_x']) if not pd.isna(r['station_position_x']) else None,
                        "y": float(r['station_position_y']) if not pd.isna(r['station_position_y']) else None,
                    }
                })
            # Asteroid belts
            a_df = s_df[s_df['object_type'] == 'asteroid_belt']
            for _, r in a_df.iterrows():
                system["asteroidBelts"].append({
                    "id": nz(r['asteroid_belt_id']),
                    "distance": nz(r['asteroid_belt_distance']),
                    "resources": split_resources(r['asteroid_belt_resources']),
                    "count": int(r['asteroid_belt_count']) if not pd.isna(r['asteroid_belt_count']) else None
                })
            systems.append(system)
        galaxies.append({ "id": nz(g_id), "name": nz(g_name), "systems": systems })
    data = {"galaxies": galaxies}
    out_path = Path(out_path)
    out_path.write_text(json.dumps(to_native(data), ensure_ascii=False, indent=2), encoding='utf-8')
    print("Written:", out_path)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python csv_to_json.py input.csv output.json")
        sys.exit(2)
    convert(sys.argv[1], sys.argv[2])
