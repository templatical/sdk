import type {
    Block,
    BlockType,
    CustomBlockDefinition,
    DisplayConditionsConfig,
    FontsConfig,
    MergeTag,
    MergeTagsConfig,
    SyntaxPreset,
    SyntaxPresetName,
    TemplateContent,
    TemplateSettings,
    ThemeOverrides,
    ViewportSize,
} from './index';

// Re-export OSS types used by Cloud consumers
export type {
    SyntaxPreset,
    SyntaxPresetName,
    ViewportSize,
};

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export interface Template {
    id: string;
    content: TemplateContent;
}

export interface TemplateSnapshot {
    id: string;
    template_id: string;
    content: TemplateContent;
    is_autosave: boolean;
    created_at: string;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export interface Comment {
    id: string;
    template_id: string;
    block_id: string | null;
    parent_id: string | null;
    body: string;
    author_identifier: string;
    author_name: string;
    resolved_at: string | null;
    resolved_by_identifier: string | null;
    resolved_by_name: string | null;
    created_at: string;
    updated_at: string;
    replies: Comment[];
}

export type CommentThread = Comment;

export type CommentEventType =
    | 'created'
    | 'updated'
    | 'deleted'
    | 'resolved'
    | 'unresolved';

export interface CommentEvent {
    type: CommentEventType;
    comment: Comment;
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export type MediaCategory = 'images' | 'documents' | 'videos' | 'audio';

export type MediaConversion = 'original' | 'small' | 'medium' | 'large';

export interface MediaItem {
    id: string;
    filename: string;
    mime_type: string;
    size: number;
    url: string;
    small_url: string | null;
    medium_url: string | null;
    large_url: string | null;
    folder_id: string | null;
    conversions_generated: boolean;
    width: number | null;
    height: number | null;
    alt_text: string;
    created_at: string;
    updated_at: string;
}

export interface MediaFolder {
    id: string;
    project_id: string;
    parent_id: string | null;
    name: string;
    children?: MediaFolder[];
    created_at: string;
}

export interface MediaBrowseParams {
    folder_id?: string | null;
    search?: string;
    category?: string;
    sort?: string;
    cursor?: string;
}

export interface MediaBrowseResponse {
    data: MediaItem[];
    meta: {
        path: string;
        per_page: number;
        next_cursor: string | null;
        prev_cursor: string | null;
    };
}

export interface MediaUsageInfo {
    template_count: number;
    template_names: string[];
}

export interface MediaUsageResponse {
    data: Record<string, MediaUsageInfo>;
}

// ---------------------------------------------------------------------------
// Saved Modules
// ---------------------------------------------------------------------------

export interface SavedModule {
    id: string;
    name: string;
    content: Block[];
    created_at: string;
    updated_at: string;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type FindingSeverity = 'high' | 'medium' | 'low';

export type ScoringCategory =
    | 'spam'
    | 'readability'
    | 'accessibility'
    | 'bestPractices';

export interface ScoringFinding {
    id: string;
    severity: FindingSeverity;
    message: string;
    blockId: string | null;
    category: ScoringCategory;
    suggestion: string;
}

export interface CategoryScore {
    score: number;
    findings: ScoringFinding[];
}

export interface ScoringResult {
    score: number;
    categories: Record<ScoringCategory, CategoryScore>;
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

export interface HealthCheckResult {
    api: { ok: boolean; latency: number };
    websocket: { ok: boolean; error?: string };
    auth: { ok: boolean; error?: string };
    overall: boolean;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface TokenData {
    token: string;
    expires_at: number;
    project_id: string;
    tenant: string;
    test_email?: {
        allowed_emails: string[];
        signature: string;
    };
    user?: {
        id: string;
        name: string;
        signature: string;
    };
}

export interface AuthRequestOptions {
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
    credentials?: RequestCredentials;
}

export interface AuthConfig {
    url: string;
    baseUrl?: string;
    requestOptions?: AuthRequestOptions;
    onError?: (error: Error) => void;
}

export interface TestEmailConfig {
    allowedEmails: string[];
    signature: string;
}

export interface UserConfig {
    id: string;
    name: string;
    signature: string;
}

export interface DirectAuthConfig {
    mode: 'direct';
    clientId: string;
    clientSecret: string;
    tenant: string;
    baseUrl?: string;
}

export interface ProxyAuthConfig {
    mode: 'proxy';
    url: string;
    baseUrl?: string;
    requestOptions?: AuthRequestOptions;
}

export type HeadlessAuthConfig = DirectAuthConfig | ProxyAuthConfig;

// ---------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------

export interface Collaborator {
    id: string;
    name: string;
    color: string;
    selectedBlockId: string | null;
}

// ---------------------------------------------------------------------------
// MCP Operations
// ---------------------------------------------------------------------------

export type McpOperation =
    | 'add_block'
    | 'update_block'
    | 'delete_block'
    | 'move_block'
    | 'update_settings'
    | 'set_content'
    | 'update_block_style';

export interface McpOperationPayload {
    operation: McpOperation;
    data: Record<string, unknown>;
    timestamp: number;
}

// ---------------------------------------------------------------------------
// SDK Configuration
// ---------------------------------------------------------------------------

export interface SaveResult {
    templateId: string;
    html: string;
    mjml: string;
    content: TemplateContent;
}

export interface AiConfig {
    chat?: boolean;
    scoring?: boolean;
    designToTemplate?: boolean;
    rewrite?: boolean;
}

export interface McpConfig {
    enabled: boolean;
    onOperation?: (payload: McpOperationPayload) => void;
}

export interface CollaborationConfig {
    enabled: boolean;
    onCollaboratorJoined?: (collaborator: Collaborator) => void;
    onCollaboratorLeft?: (collaborator: Collaborator) => void;
    onBlockLocked?: (event: {
        blockId: string;
        collaborator: Collaborator;
    }) => void;
    onBlockUnlocked?: (event: {
        blockId: string;
        collaborator: Collaborator;
    }) => void;
}

export interface WebSocketServerConfig {
    host: string;
    port: number;
    app_key: string;
}

export interface MediaRequestContext {
    accept?: MediaCategory[];
}

export interface TemplaticalConfig {
    container: string | HTMLElement;
    auth: Omit<AuthConfig, 'onError'>;
    baseUrl?: string;
    theme?: ThemeOverrides;
    locale?: string;
    ai?: AiConfig | false;
    onCreate?: (template: Template) => void;
    onLoad?: (template: Template) => void;
    onSave?: (result: SaveResult) => void;
    onError?: (error: Error) => void;
    onUnmount?: () => void;
    mergeTags?: MergeTagsConfig;
    onRequestMergeTag?: () => Promise<MergeTag | null>;
    onRequestMedia?: (
        context: MediaRequestContext,
    ) => Promise<MediaItem | null>;
    displayConditions?: DisplayConditionsConfig;
    fonts?: FontsConfig;
    autoSave?: boolean;
    autoSaveDebounce?: number;
    onBeforeTestEmail?: (html: string) => string | Promise<string>;
    customBlocks?: CustomBlockDefinition[];
    commenting?: boolean;
    onComment?: (event: CommentEvent) => void;
    mcp?: McpConfig;
    collaboration?: CollaborationConfig;
    modules?: boolean;
}

export interface TemplaticalInstance {
    setTheme(theme: ThemeOverrides): void;
    create(content?: TemplateContent): Promise<Template>;
    load(templateId: string): Promise<Template>;
    save(): Promise<SaveResult>;
    unmount(): void;
}

export interface EditorState {
    template: Template | null;
    content: TemplateContent;
    selectedBlockId: string | null;
    viewport: ViewportSize;
    darkMode: boolean;
    previewMode: boolean;
    isDirty: boolean;
    isSaving: boolean;
    isLoading: boolean;
}

export interface ApiResponse<T> {
    data: T;
}

export interface ApiError {
    message: string;
    errors?: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Plan Configuration
// ---------------------------------------------------------------------------

export interface PlanFeatures {
    media_folders: boolean;
    import_from_url: boolean;
    auto_save: boolean;
    custom_fonts: boolean;
    theme_customization: boolean;
    html_block: boolean;
    export_mjml: boolean;
    white_label: boolean;
    test_email: boolean;
    ai_generation: boolean;
    custom_blocks: boolean;
    commenting: boolean;
    collaboration: boolean;
    saved_modules: boolean;
    headless_sdk: boolean;
    pluggable_media: boolean;
}

export interface PlanLimits {
    max_file_size_mb: number;
    max_templates: number | null;
    media_categories: string[];
    storage_limit_bytes: number;
}

export interface StorageInfo {
    used_bytes: number;
    limit_bytes: number;
}

export interface MediaCategoryData {
    mime_types: string[];
    extensions: string[];
}

export interface MediaConfig {
    use_media_library: boolean;
    categories: Record<string, MediaCategoryData>;
    max_file_size: number;
}

export interface PlanConfig {
    features: PlanFeatures;
    limits: PlanLimits;
    template_count: number;
    plan: string;
    media: MediaConfig;
    storage: StorageInfo;
    websocket: WebSocketServerConfig;
}

export interface AiChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

// ---------------------------------------------------------------------------
// Headless SDK
// ---------------------------------------------------------------------------

export interface HeadlessConfig {
    auth: HeadlessAuthConfig;
    baseUrl?: string;
    defaultFontFamily?: string;
    mergeTags?: MergeTagsConfig;
    displayConditions?: DisplayConditionsConfig;
    customBlocks?: CustomBlockDefinition[];
    modules?: boolean;
    onRequestMedia?: (
        context: MediaRequestContext,
    ) => Promise<MediaItem | null>;
    onError?: (error: Error) => void;
}

export interface CreateCommentData {
    body: string;
    blockId?: string;
    parentId?: string;
    authorIdentifier: string;
    authorName: string;
}

export interface UpdateCommentData {
    body: string;
}

export interface AiGenerateOptions {
    conversationId?: string;
}

export interface AiStreamEvent {
    type: 'text' | 'done' | 'error';
    text?: string;
    content?: TemplateContent;
    conversationId?: string;
    error?: string;
}

export interface RewriteData {
    text: string;
    instruction: string;
    blockId: string;
}

export interface AiScoreOptions {
    fixFindingId?: string;
}

export interface HeadlessTemplaticalInstance {
    readonly isPluggableMediaEnabled: boolean;
    requestMedia(context?: MediaRequestContext): Promise<MediaItem | null>;

    create(content?: TemplateContent): Promise<Template>;
    load(templateId: string): Promise<Template>;
    save(): Promise<Template>;

    getContent(): TemplateContent;
    setContent(content: TemplateContent): void;

    addBlock(
        block: Block,
        targetSectionId?: string,
        columnIndex?: number,
        index?: number,
    ): void;
    updateBlock(blockId: string, updates: Partial<Block>): void;
    removeBlock(blockId: string): void;
    moveBlock(
        blockId: string,
        newIndex: number,
        targetSectionId?: string,
        columnIndex?: number,
    ): void;

    updateSettings(updates: Partial<TemplateSettings>): void;

    exportHtml(templateId: string): Promise<{ html: string; mjml?: string }>;

    snapshots: {
        list(): Promise<TemplateSnapshot[]>;
        create(): Promise<void>;
        restore(snapshotId: string): Promise<Template>;
    };

    comments: {
        list(): Promise<Comment[]>;
        create(data: CreateCommentData): Promise<Comment>;
        update(commentId: string, data: UpdateCommentData): Promise<Comment>;
        delete(commentId: string): Promise<void>;
        resolve(commentId: string): Promise<Comment>;
    };

    ai: {
        generate(
            prompt: string,
            options?: AiGenerateOptions,
        ): AsyncGenerator<AiStreamEvent>;
        rewriteText(data: RewriteData): AsyncGenerator<AiStreamEvent>;
        score(options?: AiScoreOptions): AsyncGenerator<AiStreamEvent>;
    };

    media: {
        browse(params?: MediaBrowseParams): Promise<MediaBrowseResponse>;
        upload(file: File | Blob, folderId?: string): Promise<MediaItem>;
        delete(ids: string[]): Promise<void>;
        move(ids: string[], folderId: string): Promise<void>;
        importFromUrl(url: string, folderId?: string): Promise<MediaItem>;
        folders: {
            list(): Promise<MediaFolder[]>;
            create(name: string, parentId?: string): Promise<MediaFolder>;
            rename(folderId: string, name: string): Promise<MediaFolder>;
            delete(folderId: string): Promise<void>;
        };
    };

    modules: {
        list(search?: string): Promise<SavedModule[]>;
        create(name: string, content: Block[]): Promise<SavedModule>;
        update(
            id: string,
            data: Partial<{ name: string; content: Block[] }>,
        ): Promise<SavedModule>;
        delete(id: string): Promise<void>;
        insert(moduleId: string): void;
    };

    history: {
        undo(): void;
        redo(): void;
        readonly canUndo: boolean;
        readonly canRedo: boolean;
        clear(): void;
    };

    autoSave: {
        enable(options?: { debounce?: number }): void;
        disable(): void;
        flush(): Promise<void>;
    };

    realtime: {
        connect(): Promise<void>;
        disconnect(): void;
        on(event: string, handler: (...args: unknown[]) => void): () => void;
    };

    healthCheck(): Promise<HealthCheckResult>;

    createBlock(type: BlockType): Block;

    on<K extends keyof HeadlessEvents>(
        event: K,
        handler: (data: HeadlessEvents[K]) => void,
    ): () => void;
    off<K extends keyof HeadlessEvents>(
        event: K,
        handler: (data: HeadlessEvents[K]) => void,
    ): void;

    destroy(): void;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type HeadlessEvents = {
    'template:created': Template;
    'template:loaded': Template;
    'template:saved': Template;
    'content:changed': TemplateContent;
    'block:added': {
        block: Block;
        sectionId?: string;
        columnIndex?: number;
    };
    'block:updated': { blockId: string; updates: Partial<Block> };
    'block:removed': { blockId: string };
    'block:moved': {
        blockId: string;
        newIndex: number;
        sectionId?: string;
        columnIndex?: number;
    };
    'settings:updated': Partial<TemplateSettings>;
    'snapshot:created': TemplateSnapshot;
    'snapshot:restored': TemplateSnapshot;
    'comment:created': Comment;
    'comment:updated': Comment;
    'comment:deleted': { commentId: string };
    'comment:resolved': Comment;
    'export:completed': { html: string; mjml?: string };
    'history:undo': { canUndo: boolean; canRedo: boolean };
    'history:redo': { canUndo: boolean; canRedo: boolean };
    'autosave:saved': Template;
    'module:created': SavedModule;
    'module:updated': SavedModule;
    'module:deleted': { moduleId: string };
    'module:inserted': { moduleId: string; blockCount: number };
    error: Error;
};
