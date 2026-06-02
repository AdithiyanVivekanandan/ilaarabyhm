import { v2 as cloudinary } from 'cloudinary'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/requireAdmin'

export async function POST(request: Request) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  })

  const adminUser = await requireAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await request.json()
  const imageUrl = typeof payload.imageUrl === 'string' ? payload.imageUrl.trim() : ''
  if (!imageUrl) {
    return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 })
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  if (!cloudName) {
    return NextResponse.json({ error: 'Cloudinary configuration missing' }, { status: 500 })
  }

  const expectedOrigin = `https://res.cloudinary.com`

  try {
    const url = new URL(imageUrl)
    if (url.origin !== expectedOrigin) {
      return NextResponse.json({ error: 'Invalid Cloudinary URL' }, { status: 400 })
    }

    const pathSegments = url.pathname.split('/').filter(Boolean)
    const uploadIndex = pathSegments.indexOf('upload')
    if (uploadIndex === -1) {
      return NextResponse.json({ error: 'Invalid Cloudinary URL' }, { status: 400 })
    }

    const publicIdSegments = pathSegments.slice(uploadIndex + 1)
    if (publicIdSegments.length < 2) {
      return NextResponse.json({ error: 'Invalid Cloudinary URL' }, { status: 400 })
    }

    // Drop version prefix if present
    if (/^v\d+$/.test(publicIdSegments[0])) {
      publicIdSegments.shift()
    }

    const publicIdWithExt = publicIdSegments.join('/')
    const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '')

    if (!publicId.startsWith('ilaara/products/')) {
      return NextResponse.json({ error: 'Unauthorized path' }, { status: 403 })
    }

    const result = await cloudinary.uploader.destroy(publicId)
    return NextResponse.json({ result })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
