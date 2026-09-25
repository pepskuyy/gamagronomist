'use client'

import { GeoJSON } from 'react-leaflet'
import { dominantFase, FASE_CONFIG, formatHa, SimotandiWilayahRow } from '@/lib/simotandi-fase'

interface Props {
  data: any | null
  rowsByKdkb: Map<string, SimotandiWilayahRow>
  selectedKdkb: string | null
  onSelect: (kdkb: string) => void
  dataKey: string
}

/**
 * Layer choropleth fase tanam padi per kabupaten.
 * Hanya dirender di dalam MapContainer (react-leaflet), komponen ini
 * di-import statis oleh MapView yang sudah di-dynamic import.
 */
export default function FaseTanamLayer({ data, rowsByKdkb, selectedKdkb, onSelect, dataKey }: Props) {
  if (!data?.features?.length) return null

  const style = (feature: any) => {
    const kdkb = feature?.properties?.kdkb
    const row = rowsByKdkb.get(kdkb)
    const isSelected = kdkb === selectedKdkb

    if (!row) {
      return { fillColor: '#94a3b8', fillOpacity: 0.08, color: '#e2e8f0', weight: 1 }
    }
    const fase = dominantFase(row)
    return {
      fillColor: FASE_CONFIG[fase].color,
      fillOpacity: isSelected ? 0.8 : 0.55,
      color: isSelected ? '#0f172a' : '#ffffff',
      weight: isSelected ? 3 : 1,
    }
  }

  const onEachFeature = (feature: any, layer: any) => {
    const kdkb = feature?.properties?.kdkb
    const row = rowsByKdkb.get(kdkb)

    if (row) {
      const fase = dominantFase(row)
      layer.bindTooltip(
        `<div style="font-size:12px;line-height:1.45">
           <strong>${row.nama}</strong><br/>
           Fase Dominan: <span style="color:${FASE_CONFIG[fase].color};font-weight:700">${FASE_CONFIG[fase].label}</span><br/>
           Standing Crop: <strong>${formatHa(row.standingCrop)} Ha</strong>
         </div>`,
        { sticky: true }
      )
    } else {
      layer.bindTooltip(`<div style="font-size:12px"><strong>${feature?.properties?.nama ?? kdkb}</strong><br/>Belum ada data</div>`, {
        sticky: true,
      })
    }

    layer.on({
      click: () => onSelect(kdkb),
      mouseover: (e: any) => e.target.setStyle({ weight: 2.5, fillOpacity: 0.75 }),
      mouseout: (e: any) => e.target.setStyle(style(feature)),
    })
  }

  return <GeoJSON key={dataKey} data={data} style={style} onEachFeature={onEachFeature} />
}
