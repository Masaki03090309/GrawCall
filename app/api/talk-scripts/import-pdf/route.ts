import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { extractTalkScriptFromPDF, validatePDFFile } from '@/lib/openai-vision'

/**
 * POST /api/talk-scripts/import-pdf
 *
 * Import talk script from PDF using GPT-5 Vision API
 *
 * Request: multipart/form-data
 * - file: PDF file (max 10MB)
 * - project_id: Project UUID
 *
 * Response:
 * - 200: { success: true, data: ExtractedTalkScript }
 * - 401: { error: 'UNAUTHORIZED', message: '...' }
 * - 403: { error: 'FORBIDDEN', message: '...' }
 * - 422: { error: 'VALIDATION_ERROR', message: '...' }
 * - 500: { error: 'PDF_IMPORT_FAILED', message: '...' }
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const supabase = await createClient()
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: 'ログインが必要です'
        },
        { status: 401 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const projectId = formData.get('project_id') as string | null

    // Validate input
    if (!file) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'PDFファイルを選択してください'
        },
        { status: 422 }
      )
    }

    if (!projectId) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'プロジェクトIDが必要です'
        },
        { status: 422 }
      )
    }

    // Validate project_id format (UUID)
    try {
      z.string().uuid().parse(projectId)
    } catch {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: '無効なプロジェクトIDです'
        },
        { status: 422 }
      )
    }

    // Check project access permission
    const { data: projectMember, error: projectError } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (projectError || !projectMember) {
      // Check if user is owner
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (userData?.role !== 'owner') {
        return NextResponse.json(
          {
            error: 'FORBIDDEN',
            message: 'このプロジェクトへのアクセス権限がありません'
          },
          { status: 403 }
        )
      }
    } else {
      // Check if user is director or owner
      if (projectMember.role !== 'director') {
        return NextResponse.json(
          {
            error: 'FORBIDDEN',
            message: 'トークスクリプトの編集にはディレクター権限が必要です'
          },
          { status: 403 }
        )
      }
    }

    // Validate PDF file
    const validation = validatePDFFile(file)
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: validation.error
        },
        { status: 422 }
      )
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    console.log(`[PDF Import] Processing PDF file: ${file.name}, size: ${file.size} bytes`)

    // Extract talk script using GPT-5 Vision API
    const extracted = await extractTalkScriptFromPDF(buffer)

    console.log(
      `[PDF Import] Successfully extracted talk script with ${extracted.hearing_items.length} hearing items`
    )

    // Return extracted data
    return NextResponse.json({
      success: true,
      data: extracted
    })

  } catch (error) {
    console.error('[PDF Import] Error:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'PDF_IMPORT_FAILED',
          message: `PDF取り込みに失敗しました: ${error.message}`
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        error: 'PDF_IMPORT_FAILED',
        message: 'PDF取り込みに失敗しました。PDFの内容を確認してください。'
      },
      { status: 500 }
    )
  }
}
