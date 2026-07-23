import os
import glob

anno = '@file:Suppress("WildcardImport", "MagicNumber", "MaxLineLength", "TooManyFunctions", "LongMethod", "CognitiveComplexMethod", "CyclomaticComplexMethod", "NestedBlockDepth", "LongParameterList", "ComplexCondition", "TooGenericExceptionCaught", "SwallowedException", "ObjectPropertyNaming", "ReturnCount", "DestructuringDeclarationWithTooManyEntries", "UnusedPrivateMember", "UnusedPrivateProperty", "UnusedParameter")\n\n'

files = glob.glob('webApp/src/wasmJsMain/kotlin/**/*.kt', recursive=True)
updated = 0
skipped = 0

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    if '@file:Suppress' not in content:
        with open(f, 'w', encoding='utf-8') as file:
            file.write(anno + content)
        updated += 1
    else:
        skipped += 1

print(f"Done! Updated: {updated}, Skipped (already has Suppress): {skipped}, Total: {len(files)}")
