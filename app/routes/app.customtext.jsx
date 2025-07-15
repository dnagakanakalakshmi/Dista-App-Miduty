import {
    json
} from "@remix-run/node";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
import { useLoaderData, Form } from "@remix-run/react";
import {
    Page,
    Card,
    TextField,
    BlockStack,
    Text,
    Layout,
    Box,
    Button,
    InlineStack,
    Modal
} from '@shopify/polaris';
import { useState , useEffect} from 'react';
import shopify from "../shopify.server";

// --- Loader: fetch settings for a shop ---
export async function loader({ request }) {
    const { session } = await shopify.authenticate.admin(request);
    const { shop } = session;
    let settings = await prisma.widgetSettings.findFirst({
        where: { shop },
    });

    // If not found, create default settings
    if (!settings) {
        settings = await prisma.widgetSettings.create({
            data: { shop },
        });
    }

    return json({ settings });
}

// --- Action: update settings for a shop ---
export async function action({ request }) {
    const form = await request.formData();
    const { session } = await shopify.authenticate.admin(request);
    const { shop } = session;
    const starsText = form.get("starsText");
    const saveText = form.get("saveText");

    const existing = await prisma.widgetSettings.findFirst({ where: { shop } });
    if (existing) {
        await prisma.widgetSettings.updateMany({
            where: { shop },
            data: {
                starsText,
                saveText,
            },
        });
    } else {
        await prisma.widgetSettings.create({
            data: {
                shop,
                starsText,
                saveText,
            },
        });
    }
    return json({ success: true });
}

function Star({ color }) {
    return (
        <svg width="24" height="24" fill={color} viewBox="0 0 24 24">
            <path d="M12 17.3l6.18 3.7-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
        </svg>
    );
}

export default function AdminSettings() {
    const { settings } = useLoaderData();
   
    const [text, setText] = useState(settings.starsText || '{count} review/reviews');
    const [saveText, setSaveText] = useState(settings.saveText || 'Save {percent}%');
    const [activeModal, setActiveModal] = useState(null); // 'stars' | 'save' | null

    useEffect(() => {
        setText(settings.starsText || '{count} review/reviews');
        setSaveText(settings.saveText || 'Save {percent}%');
    }, [settings]);

    // Replace {count} with a sample value for preview, and style the count
    function getStyledPreview(text) {
        const sampleCount = '97';
        const parts = text.split('{count}');
        return (
            <span style={{ fontSize: 16, lineHeight: '28px', fontWeight: 500, color: '#212b36', marginLeft: 8 }}>
                {parts[0]}
                <span style={{ fontSize: 16, fontWeight: 500, color: '#212b36', verticalAlign: 'middle' }}>{sampleCount}</span>
                {parts[1]}
            </span>
        );
    }

    // Replace {percent} with a sample value for preview, and style the percent
    function getStyledSavePreview(text) {
        const samplePercent = '30';
        const parts = text.split('{percent}');
        return (
            <span style={{ fontSize: 16, lineHeight: '28px', fontWeight: 500, color: '#212b36', marginLeft: 8 }}>
                {parts[0]}
                <span style={{ fontSize: 16, fontWeight: 500, color: '#212b36', verticalAlign: 'middle' }}>{samplePercent}</span>
                {parts[1]}
            </span>
        );
    }

    // Modal content for editing stars
    const starEditModal = (
        <Modal
            open={activeModal === 'stars'}
            onClose={() => setActiveModal(null)}
            title="Edit Star Widget"
        >
            <Modal.Section>
                <Form method="post">
                    <input type="hidden" name="shop" value={settings.shop} />
                    <TextField
                        label="Text"
                        name="starsText"
                        value={text}
                        onChange={setText}
                        autoComplete="off"
                        helpText="Use {count} as a placeholder for the review count."
                    />
                    <input type="hidden" name="saveText" value={saveText} />
                    <Box paddingBlockStart="400">
                        <Button submit primary onClick={() => setActiveModal(null)}>Save</Button>
                    </Box>
                </Form>
            </Modal.Section>
        </Modal>
    );

    // Modal content for editing save
    const saveEditModal = (
        <Modal
            open={activeModal === 'save'}
            onClose={() => setActiveModal(null)}
            title="Edit Save Message"
        >
            <Modal.Section>
                <Form method="post">
                    <input type="hidden" name="shop" value={settings.shop} />
                    <input type="hidden" name="starsText" value={text} />
                    <TextField
                        label="Save Text"
                        name="saveText"
                        value={saveText}
                        onChange={setSaveText}
                        autoComplete="off"
                        helpText="Use {percent} as a placeholder for the percent saved."
                    />
                    <Box paddingBlockStart="400">
                        <Button submit primary onClick={() => setActiveModal(null)}>Save</Button>
                    </Box>
                </Form>
            </Modal.Section>
        </Modal>
    );

    return (
        <Page title="Product Card Text Customization">
            <Layout>
                <Layout.Section>
                    <Box paddingBlockEnd="400" />
                    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
                        {/* Stars Section */}
                        <Card>
                            <BlockStack gap="400">
                                <InlineStack align="space-between">
                                    <Text variant="headingMd" as="h2">Reviews Text</Text>
                                    <Button onClick={() => setActiveModal('stars')}>Edit</Button>
                                </InlineStack>
                                <Text variant="bodySm" as="p" color="subdued" style={{ marginTop: 8 }}>
                                    Customize how the number of reviews appears on your product cards. Use <b>{'{count}'}</b> as a placeholder for the review count (e.g., "97 reviews").
                                </Text>
                                <Box padding="400" background="bg-surface-secondary" minWidth="320px">
                                    <InlineStack gap="200" align="center">
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <Star key={i} color="#f6a51b" />
                                            ))}
                                        </div>
                                        {getStyledPreview(text)}
                                    </InlineStack>
                                </Box>
                            </BlockStack>
                        </Card>
                        {/* Save Section */}
                        <Card>
                            <BlockStack gap="400">
                                <InlineStack align="space-between">
                                    <Text variant="headingMd" as="h2">Discount Badge Text</Text>
                                    <Button onClick={() => setActiveModal('save')}>Edit</Button>
                                </InlineStack>
                                <Text variant="bodySm" as="p" color="subdued" style={{ marginTop: 8 }}>
                                    Customize the discount badge text shown on your product cards. Use <b>{'{percent}'}</b> as a placeholder for the discount percentage (e.g., "Save 30%").
                                </Text>
                                <Box padding="400" background="bg-surface-secondary" minWidth="320px">
                                    {getStyledSavePreview(saveText)}
                                </Box>
                            </BlockStack>
                        </Card>
                    </div>
                    {starEditModal}
                    {saveEditModal}
                </Layout.Section>
            </Layout>
        </Page>
    );
}