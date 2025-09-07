import { NextRequest, NextResponse } from 'next/server';
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from '@/lib/modelClient';

export async function GET() {
  return NextResponse.json({
    owner: process.env.GITHUB_REPO_OWNER || 'github',
    name: process.env.GITHUB_REPO_NAME || 'solutions-engineering',
    models: AVAILABLE_MODELS,
    defaultModel: DEFAULT_MODEL_ID,
  });
}

export async function POST(request: NextRequest) {
  const { owner, name } = await request.json();
  
  if (!owner || !name) {
    return NextResponse.json(
      { error: 'Owner and name are required' },
      { status: 400 }
    );
  }

  // Store in environment variables (this would be temporary for the session)
  // In a real app, you'd store this in a database or user preferences
  return NextResponse.json({
    owner,
    name,
    message: 'Repository configuration updated'
  });
}