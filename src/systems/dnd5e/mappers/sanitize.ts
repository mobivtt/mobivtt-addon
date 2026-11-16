const ENRICHED_REF = /@\w+\[([^\]|]+)(?:\|[^\]]+)?]/g;
const ITEM_ID_REF = /\.([A-Za-z0-9]{16})\b/g;

let itemNameMap: Map<string, string> | null = null;

export function setItemNameMap(items: any[]): void {
    itemNameMap = new Map(
        items.filter(i => i.id || i._id).map(i => [i.id ?? i._id, i.name ?? '']),
    );
}

export function stripEnrichedText(html: string): string {
    let result = html.replace(ENRICHED_REF, '$1');
    if (itemNameMap) {
        result = result.replace(ITEM_ID_REF, (match, id) => {
            const name = itemNameMap!.get(id);
            return name ?? match;
        });
    }
    return result;
}
