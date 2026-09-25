'use client'

import { GeoJSON } from 'react-leaflet'
import { dominantFase, FASE_CONFIG, formatHa, SimotandiWilayahRow } from '@/lib/simotandi-fase'

interface Props {
  data: any | null
  rowsByKdkc: Map<string, SimotandiWilayahRow>
  selectedKdkc: string | null
  onSelect: (kdkc: string) => void
  dataKey: string
}

/**
 * Layer batas kecamatan (opsional, hanya untuk kabupaten terpilih).
 * Dimuat lazy oleh parent saat toggle "Batas Kecamatan" diaktifkan.
 */
export default function KecamatanLayer({ data, rowsByKdkc, selectedKdkc, onSelect, dataKey }: Props) {
  if (!data?.features?.length) return null

  const style = (feature: any) => {
    const kdkc = feature?.properties?.kdkc
    const row = rowsByKdkc.get(kdkc)
    const isSelected = kdkc === selectedKdkc

    if (!row) {
      return { fillColor: '#94a3b8', fillOpacity: 0.05, color: '#0f172a', weight: 1 }
    }
    return {
      fillColor: FASE_CONFIG[dominantFase(row)].color,
      fillOpacity: isSelected ? 0.75 : 0.45,
      color: '#0f172a',
      weight: isSelected ? 3 : 1,
    }
  }

  const onEachFeature = (feature: any, layer: any) => {
    const kdkc = feature?.properties?.kdkc
    const row = rowsByKdkc.get(kdkc)

    if (row) {
      layer.bindTooltip(
        `<div style="font-size:12px;line-height:1.45">
           <strong>${row.nama}</strong><br/>
           Fase Dominan: <span style="color:${FASE_CONFIG[dominantFase(row)].color};font-weight:700">${FASE_CONFIG[dominantFase(row)].label}</span><br/>
           Standing Crop: <strong>${formatHa(row.standingCrop)} Ha</strong>
         </div>`,
        { sticky: true }
      )
    }

    layer.on({
      click: () => onSelect(kdkc),
      mouseover: (e: any) => e.target.setStyle({ weight: 2.5, fillOpacity: 0.7 }),
      mouseout: (e: any) => e.target.setStyle(style(feature)),
    })
  }

  return <GeoJSON key={dataKey} data={data} style={style} onEachFeature={onEachFeature} />
}
