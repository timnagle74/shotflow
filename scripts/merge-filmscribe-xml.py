#!/usr/bin/env python3
"""
Merge two FilmScribe XMLs:
- Takes camera original filenames from PLATES version
- Fills in missing VFX markers from original XML

In FilmScribe XML, VFX markers are Comment elements that are
siblings of Event elements (not children). Each Comment contains
its own ClipName (camera original) and Text (VFX note).
"""

import xml.etree.ElementTree as ET
import sys
import re
import copy

def get_vfx_code(text):
    """Extract VFX shot code from marker text"""
    if not text:
        return None
    match = re.search(r'VFX[_\s](\d+[_\s]\d+)', text)
    if match:
        return match.group(1).replace(' ', '_')
    return None

def get_comment_info(comment):
    """Extract VFX code, text, and clip name from a Comment element"""
    text_elem = comment.find('Text')
    vfx_text = text_elem.text if text_elem is not None else None
    vfx_code = get_vfx_code(vfx_text)
    
    # ClipName is inside Source element within Comment
    clip_name = None
    source = comment.find('Source')
    if source is not None:
        clip_elem = source.find('ClipName')
        if clip_elem is not None:
            clip_name = clip_elem.text
    
    # Get timecode for reference
    timecode = None
    master = comment.find('Master')
    if master is not None:
        tc_elem = master.find('Timecode')
        if tc_elem is not None:
            timecode = tc_elem.text
    
    return vfx_code, vfx_text, clip_name, timecode

def merge_filmscribe(plates_file, xml_file, output_file):
    # Parse both files
    plates_tree = ET.parse(plates_file)
    xml_tree = ET.parse(xml_file)
    
    plates_root = plates_tree.getroot()
    xml_root = xml_tree.getroot()
    
    # Build maps of VFX codes from Comments
    plates_vfx = {}
    xml_vfx = {}
    
    plates_events = plates_root.find('.//Events')
    xml_events = xml_root.find('.//Events')
    
    # Get VFX info from Comment elements (siblings of Event, not children)
    for comment in plates_events.findall('Comment'):
        if comment.get('Type') == 'Locator':
            code, text, clip, tc = get_comment_info(comment)
            if code:
                plates_vfx[code] = {'comment': comment, 'text': text, 'clip': clip, 'tc': tc}
    
    for comment in xml_events.findall('Comment'):
        if comment.get('Type') == 'Locator':
            code, text, clip, tc = get_comment_info(comment)
            if code:
                xml_vfx[code] = {'comment': comment, 'text': text, 'clip': clip, 'tc': tc}
    
    print(f"PLATES has {len(plates_vfx)} VFX markers")
    print(f"XML has {len(xml_vfx)} VFX markers")
    
    missing_codes = set(xml_vfx.keys()) - set(plates_vfx.keys())
    print(f"Missing from PLATES: {sorted(missing_codes)}")
    
    print("\n" + "="*60)
    print("MERGE REPORT")
    print("="*60)
    
    print("\n✅ VFX shots WITH camera filenames (from PLATES):\n")
    for code in sorted(plates_vfx.keys()):
        info = plates_vfx[code]
        clip = info['clip'] or '(no camera filename)'
        print(f"  {code}: {clip}")
    
    print("\n❌ VFX shots MISSING from PLATES (will add from XML):\n")
    for code in sorted(missing_codes):
        info = xml_vfx[code]
        print(f"  {code}: {info['text']}")
        print(f"    Clip: {info['clip'] or 'N/A'}")
        print(f"    TC: {info['tc'] or 'N/A'}")
    
    # Create merged output
    merged_tree = copy.deepcopy(plates_tree)
    merged_events = merged_tree.getroot().find('.//Events')
    
    # Add missing Comments from XML
    for code in sorted(missing_codes):
        missing_comment = copy.deepcopy(xml_vfx[code]['comment'])
        merged_events.append(missing_comment)
        print(f"\n  → Added {code} from XML")
    
    # Update header counts
    list_head = merged_tree.getroot().find('.//ListHead')
    if list_head is not None:
        optical_count = list_head.find('OpticalCount')
        if optical_count is not None:
            new_count = len(plates_vfx) + len(missing_codes)
            optical_count.text = str(new_count)
    
    # Write merged file
    merged_tree.write(output_file, encoding='UTF-8', xml_declaration=True)
    
    print("\n" + "="*60)
    print(f"✅ Merged XML written to: {output_file}")
    print(f"   Total VFX shots: {len(plates_vfx) + len(missing_codes)}")
    print("="*60)

if __name__ == '__main__':
    if len(sys.argv) != 4:
        print("Usage: merge-filmscribe-xml.py <plates.xml> <original.xml> <output.xml>")
        sys.exit(1)
    
    merge_filmscribe(sys.argv[1], sys.argv[2], sys.argv[3])
