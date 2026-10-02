import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Agrolens Open API',
    description: 'Read-only API untuk data aktivitas lapangan Agrolens. Akses endpoint ini menggunakan API key yang digenerate oleh admin.',
    version: '1.0.0',
    contact: {
      name: 'Agrolens Admin',
      email: 'project.gamaagrosejati@gmail.com'
    }
  },
  servers: [{ url: '/api/v1', description: 'Agrolens Open API v1' }],
  components: {
    securitySchemes: {
      ApiKeyBearer: {
        type: 'http',
        scheme: 'bearer',
        description: 'API key dalam format Bearer token'
      },
      ApiKeyHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API key via header x-api-key'
      }
    },
    parameters: {
      from: { name: 'from', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Filter tanggal mulai (YYYY-MM-DD)' },
      to:   { name: 'to',   in: 'query', schema: { type: 'string', format: 'date' }, description: 'Filter tanggal akhir (YYYY-MM-DD)' },
      sales: { name: 'sales', in: 'query', schema: { type: 'string' }, description: 'Filter nama pelaksana (pencarian parsial)' },
      limit: { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 }, description: 'Jumlah data per halaman (maks 200)' },
      page:  { name: 'page',  in: 'query', schema: { type: 'integer', default: 1 }, description: 'Nomor halaman (1-indexed)' },
    }
  },
  security: [{ ApiKeyBearer: [] }, { ApiKeyHeader: [] }],
  paths: {
    '/demoplot': {
      get: {
        summary: 'Daftar Demo Plot (termasuk koordinat GPS)',
        description: 'Daftar sesi demo plot lapangan beserta rincian produk. Setiap baris memiliki latitude & longitude di level atas (dapat bernilai null bila belum diisi).',
        parameters: [
          { $ref: '#/components/parameters/from' },
          { $ref: '#/components/parameters/to' },
          { $ref: '#/components/parameters/sales' },
          { name: 'area', in: 'query', schema: { type: 'string' }, description: 'Filter area/desa (pencarian parsial)' },
          { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Status pengajuan: SUBMITTED, APPROVED, REJECTED, DEMO_PLOT_SELESAI' },
          { name: 'has_coords', in: 'query', schema: { type: 'string', enum: ['1'] }, description: 'Set "1" untuk hanya mengembalikan demo plot yang memiliki latitude & longitude' },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/page' },
        ],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized — API key tidak valid atau tidak disertakan' },
          '429': { description: 'Too Many Requests — rate limit 300 req/menit terlampaui' }
        }
      }
    },
    '/spot-demplot': {
      get: {
        summary: 'Spot Demplot & Pengamatan',
        description: 'Data spot demplot, pengamatan gulma/lahan, dan produk yang digunakan.',
        parameters: [
          { $ref: '#/components/parameters/from' },
          { $ref: '#/components/parameters/to' },
          { $ref: '#/components/parameters/sales' },
          { name: 'desa', in: 'query', schema: { type: 'string' }, description: 'Filter nama desa' },
          { name: 'kecamatan', in: 'query', schema: { type: 'string' }, description: 'Filter nama kecamatan' },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/page' },
        ],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
          '429': { description: 'Too Many Requests' }
        }
      }
    },
    '/farmer-gathering': {
      get: {
        summary: 'Farmer Gathering / Temu Kelompok Tani',
        description: 'Data pertemuan tani, pemimpin kelompok, biaya pelaksanaan, dan foto dokumentasi.',
        parameters: [
          { $ref: '#/components/parameters/from' },
          { $ref: '#/components/parameters/to' },
          { $ref: '#/components/parameters/sales' },
          { name: 'district', in: 'query', schema: { type: 'string' }, description: 'Filter kecamatan/kabupaten' },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/page' },
        ],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
          '429': { description: 'Too Many Requests' }
        }
      }
    },
    '/customer-behavior': {
      get: {
        summary: 'Customer Behavior (Riset Perilaku Petani)',
        description: 'Data riset perilaku petani: komoditas, preferensi produk, tempat beli, dan kendala.',
        parameters: [
          { $ref: '#/components/parameters/from' },
          { $ref: '#/components/parameters/to' },
          { $ref: '#/components/parameters/sales' },
          { name: 'commodity', in: 'query', schema: { type: 'string' }, description: 'Filter komoditas (pencarian parsial)' },
          { name: 'district', in: 'query', schema: { type: 'string' }, description: 'Filter kecamatan' },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/page' },
        ],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
          '429': { description: 'Too Many Requests' }
        }
      }
    },
    '/visit-kios': {
      get: {
        summary: 'Kunjungan Kios / Toko Pertanian',
        description: 'Laporan kunjungan tim lapangan ke kios pertanian, hasil kunjungan, dan foto dokumentasi.',
        parameters: [
          { $ref: '#/components/parameters/from' },
          { $ref: '#/components/parameters/to' },
          { $ref: '#/components/parameters/sales' },
          { name: 'kios', in: 'query', schema: { type: 'string' }, description: 'Filter nama kios' },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/page' },
        ],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
          '429': { description: 'Too Many Requests' }
        }
      }
    },
    '/visit-company': {
      get: {
        summary: 'Kunjungan Perusahaan / Perkebunan',
        description: 'Laporan kunjungan ke perusahaan: PIC, luas lahan, komoditas, dan syarat pembayaran.',
        parameters: [
          { $ref: '#/components/parameters/from' },
          { $ref: '#/components/parameters/to' },
          { $ref: '#/components/parameters/sales' },
          { name: 'company', in: 'query', schema: { type: 'string' }, description: 'Filter nama perusahaan' },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/page' },
        ],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
          '429': { description: 'Too Many Requests' }
        }
      }
    },
    '/content-video': {
      get: {
        summary: 'Konten Video',
        description: 'Data aktivitas pembuatan video konten: tema, produk yang ditampilkan, dan foto/thumbnail.',
        parameters: [
          { $ref: '#/components/parameters/from' },
          { $ref: '#/components/parameters/to' },
          { $ref: '#/components/parameters/sales' },
          { name: 'theme', in: 'query', schema: { type: 'string' }, description: 'Filter tema video' },
          { $ref: '#/components/parameters/limit' },
          { $ref: '#/components/parameters/page' },
        ],
        responses: {
          '200': { description: 'OK' },
          '401': { description: 'Unauthorized' },
          '429': { description: 'Too Many Requests' }
        }
      }
    }
  }
}

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  })
}
