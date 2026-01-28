'use client';

import React, { useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { supabase } from '../lib/supabase';
// @ts-ignore
import Swal from 'sweetalert2';
import {
    Bold, Italic, List, ListOrdered, Quote,
    ImageIcon, Undo, Redo, Loader2
} from 'lucide-react';

interface RichTextEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
    minHeight?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
    content,
    onChange,
    placeholder = 'Start writing...',
    minHeight = '200px'
}) => {
    const [uploading, setUploading] = React.useState(false);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false, // Disable headings for simplicity
            }),
            Image.configure({
                inline: false,
                allowBase64: false,
            }),
            Placeholder.configure({
                placeholder,
            }),
        ],
        content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none',
                style: `min-height: ${minHeight}`,
            },
        },
    });

    // Sync external content changes
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    // Handle image paste
    const handlePaste = useCallback(async (event: ClipboardEvent) => {
        const items = event.clipboardData?.items;
        if (!items || !editor) return;

        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                event.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    await uploadImage(file);
                }
                return;
            }
        }
    }, [editor]);

    // Attach paste listener
    useEffect(() => {
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement) {
            editorElement.addEventListener('paste', handlePaste as EventListener);
            return () => {
                editorElement.removeEventListener('paste', handlePaste as EventListener);
            };
        }
    }, [handlePaste]);

    const uploadImage = async (file: File) => {
        if (!editor) return;

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            Swal.fire({
                icon: 'warning',
                title: 'File Too Large',
                text: 'Image size must be less than 5MB',
                confirmButtonColor: '#6366f1'
            });
            return;
        }

        setUploading(true);

        try {
            const fileExt = file.name.split('.').pop() || 'png';
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `chat/${fileName}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('Image_chat')
                .upload(filePath, file);

            if (uploadError) {
                console.error('Upload error:', uploadError);
                Swal.fire({
                    icon: 'error',
                    title: 'Upload Failed',
                    html: `
                        <p class="text-gray-600 mb-2">Failed to upload image.</p>
                        <p class="text-sm text-gray-500">Please make sure the storage bucket <strong>"Image_chat"</strong> exists in Supabase.</p>
                    `,
                    confirmButtonColor: '#6366f1'
                });
                return;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('Image_chat')
                .getPublicUrl(filePath);

            const imageUrl = urlData.publicUrl;

            // Insert image into editor
            editor.chain().focus().setImage({ src: imageUrl }).run();

            // Success toast
            Swal.fire({
                icon: 'success',
                title: 'Image Uploaded',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true
            });

        } catch (error) {
            console.error('Error uploading image:', error);
            Swal.fire({
                icon: 'error',
                title: 'Upload Failed',
                text: 'An unexpected error occurred while uploading the image.',
                confirmButtonColor: '#6366f1'
            });
        } finally {
            setUploading(false);
        }
    };

    const handleImageUpload = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                await uploadImage(file);
            }
        };
        input.click();
    };

    if (!editor) {
        return (
            <div className="border border-gray-200 rounded-xl p-4 min-h-[200px] flex items-center justify-center">
                <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
        );
    }

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                    title="Bold (Ctrl+B)"
                >
                    <Bold size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`p-1.5 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                    title="Italic (Ctrl+I)"
                >
                    <Italic size={16} />
                </button>

                <div className="w-px h-5 bg-gray-200 mx-1" />

                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bulletList') ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                    title="Bullet List"
                >
                    <List size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`p-1.5 rounded-lg transition-colors ${editor.isActive('orderedList') ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                    title="Numbered List"
                >
                    <ListOrdered size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={`p-1.5 rounded-lg transition-colors ${editor.isActive('blockquote') ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                    title="Quote"
                >
                    <Quote size={16} />
                </button>

                <div className="w-px h-5 bg-gray-200 mx-1" />

                <button
                    type="button"
                    onClick={handleImageUpload}
                    disabled={uploading}
                    className="p-1.5 rounded-lg transition-colors text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                    title="Insert Image"
                >
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                </button>

                <div className="flex-1" />

                <button
                    type="button"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    className="p-1.5 rounded-lg transition-colors text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    className="p-1.5 rounded-lg transition-colors text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                    title="Redo (Ctrl+Y)"
                >
                    <Redo size={16} />
                </button>
            </div>

            {/* Editor Content */}
            <div className="p-4">
                <EditorContent editor={editor} />
            </div>

            {/* Upload Indicator */}
            {uploading && (
                <div className="px-4 pb-3">
                    <div className="flex items-center gap-2 text-xs text-indigo-600">
                        <Loader2 size={12} className="animate-spin" />
                        Uploading image...
                    </div>
                </div>
            )}

            {/* Hint */}
            <div className="px-4 pb-3">
                <p className="text-xs text-gray-400">
                    💡 Tip: Paste screenshot directly (Ctrl+V) or click the image button
                </p>
            </div>

            {/* Custom Styles for TipTap - Injected inline */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .ProseMirror {
                    outline: none;
                }
                .ProseMirror p.is-editor-empty:first-child::before {
                    color: #adb5bd;
                    content: attr(data-placeholder);
                    float: left;
                    height: 0;
                    pointer-events: none;
                }
                .ProseMirror img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 8px;
                    margin: 8px 0;
                }
                .ProseMirror ul {
                    padding-left: 1.5rem;
                    list-style-type: disc;
                }
                .ProseMirror ol {
                    padding-left: 1.5rem;
                    list-style-type: decimal;
                }
                .ProseMirror li {
                    margin-bottom: 0.25rem;
                }
                .ProseMirror li p {
                    margin: 0;
                }
                .ProseMirror blockquote {
                    border-left: 3px solid #e5e7eb;
                    padding-left: 1rem;
                    margin-left: 0;
                    color: #6b7280;
                }
            `}} />
        </div>
    );
};

export default RichTextEditor;
