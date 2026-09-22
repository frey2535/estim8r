import React, { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { filterLaborLibrary, laborItemLabel } from "@/domain/estimate/manualLineLabor";

export default function LaborItemPicker({ items = [], value, onSelect, placeholder = "Search the Labor tab library…" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = items.find((item) => item.id === value) || null;
  const results = useMemo(() => filterLaborLibrary(items, query), [items, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label="Labor library item"
          className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background px-2 py-2 text-left text-sm"
        >
          <span className={selected ? "truncate font-medium" : "truncate text-muted-foreground"}>
            {selected ? laborItemLabel(selected) : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(36rem,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Type 1/2 EMT, 3/4 PVC, flood light…"
          />
          <CommandList>
            <CommandEmpty>Nothing in the labor library fits that search. MH/unit stays 0 — this is not a NECA rate.</CommandEmpty>
            <CommandGroup>
              {results.map((item) => {
                const mh = item.labor_units?.find((unit) => unit.normal_mh != null)?.normal_mh;
                return (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => {
                      onSelect?.(item);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <Check className={`h-4 w-4 ${item.id === value ? "opacity-100" : "opacity-0"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{laborItemLabel(item)}</span>
                      <span className="block text-xs text-muted-foreground">{item.category}{item.subcategory ? ` · ${item.subcategory}` : ""}{mh != null ? ` · ${mh} MH/${item.unit}` : ""}</span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
