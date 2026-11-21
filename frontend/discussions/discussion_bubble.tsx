import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../firebase/auth_context';
import {
  BotIcon,
  ChevronRightIcon,
  CloseIcon,
  HistoryIcon,
  ImagePlusIcon,
  PlusIcon,
  SendIcon,
} from '../navigation/navigation_icons';
import {
  askAiDiscussionApi,
  clearDiscussionsApi,
  DiscussionMessage,
  getCachedDiscussions,
  getDiscussionsApi,
  setCachedDiscussions,
} from '../services/discussions_api';
import { notifyPatientsUpdated } from '../services/patients_api';
import { notifyProsthesesUpdated } from '../services/protheses_api';
import { notifyCoveragesUpdated } from '../services/coverages_api';
import { ConversationSummary, DiscussionHistory } from './discussion_history';
import { DiscussionActionForm } from './discussion_action_form';
import { isSafeImageDataUrl, prepareDiscussionImage } from './image_upload_helper';
import {
  BUBBLE_SIZE,
  Bounds,
  PanelGeometry,
  Point,
  buildSnapKeyframes,
  computePanelGeometry,
  computeTailForPanel,
  findDetourPath,
  getDefaultBubblePos,
  getEdgeMargin,
  getMinBottom,
  getObstacleRect,
  isInsideOpenRect,
  projectOutsideObstacle,
  segmentIntersectsOpenRect,
} from './bubble_detour_utils';

function formatMessageTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shouldShowTimestampSeparator(
  current: DiscussionMessage,
  previous?: DiscussionMessage
): boolean {
  if (!previous) return true;
  const currMs = Date.parse(current.createdAt || '') || 0;
  const prevMs = Date.parse(previous.createdAt || '') || 0;
  return currMs - prevMs > 5 * 60 * 1000;
}

interface AssistantMessageTextProps {
  content: string;
  animate: boolean;
  onProgress?: () => void;
  onComplete?: () => void;
}

const AssistantMessageText: React.FC<AssistantMessageTextProps> = ({
  content,
  animate,
  onProgress,
  onComplete,
}) => {
  const [visibleCount, setVisibleCount] = useState<number>(() =>
    animate ? 0 : content.length
  );
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  onProgressRef.current = onProgress;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!animate) {
      setVisibleCount(content.length);
      return;
    }

    setVisibleCount(0);
    const total = content.length;
    if (total === 0) {
      onCompleteRef.current?.();
      return;
    }

    const charsPerFrame = Math.max(1, Math.min(4, Math.ceil(total / 110)));
    let current = 0;
    let rafId = 0;
    let lastTime = 0;

    const step = (timestamp: number) => {
      if (!lastTime || timestamp - lastTime >= 16) {
        lastTime = timestamp;
        current = Math.min(total, current + charsPerFrame);
        setVisibleCount(current);
        onProgressRef.current?.();
        if (current >= total) {
          onCompleteRef.current?.();
          return;
        }
      }
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [content, animate]);

  return <>{animate ? content.slice(0, visibleCount) : content}</>;
};

// BULLE DE DISCUSSION STYLE MESSENGER AVEC ASSISTANT IA
export const DiscussionBubble: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DiscussionMessage[]>(() => getCachedDiscussions());
  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    const cached = getCachedDiscussions();
    const latest = cached[cached.length - 1];
    return latest?.conversationId || 'default';
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [draft, setDraft] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [animatingMessageId, setAnimatingMessageId] = useState<string | null>(null);

  const [snapSide, setSnapSide] = useState<'left' | 'right'>('right');
  const [isDragging, setIsDragging] = useState(false);
  const [frozenPanelGeom, setFrozenPanelGeom] = useState<PanelGeometry | null>(null);
  const [animatedBubblePos, setAnimatedBubblePos] = useState<Point | null>(null);
  const [snapKeyframes, setSnapKeyframes] = useState<{
    x: number[];
    y: number[];
    times: number[];
    duration: number;
  } | null>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>(() =>
    typeof window !== 'undefined'
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 1280, height: 800 }
  );
  const [bubblePos, setBubblePos] = useState<Point>(() =>
    getDefaultBubblePos()
  );

  const panelRef = useRef<HTMLElement | null>(null);
  const bubbleRootRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isOpenRef = useRef(isOpen);
  const isSnappingRef = useRef(false);
  const snapSideRef = useRef(snapSide);
  const bubblePosRef = useRef<Point>(bubblePos);
  const dragPanelGeomRef = useRef<PanelGeometry | null>(null);
  const dragDetourRafRef = useRef<number>(0);
  const dragDetourWaypointsRef = useRef<Point[]>([]);
  const dragDetourLastTimeRef = useRef<number>(0);
  const postDragTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const hasExplicitConversationRef = useRef(false);
  const stableKeyMapRef = useRef<Map<string, string>>(new Map());

  snapSideRef.current = snapSide;
  bubblePosRef.current = bubblePos;

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      setUnreadCount(0);
    } else {
      setIsComposerExpanded(false);
      isSnappingRef.current = false;
      setAnimatedBubblePos(null);
      setFrozenPanelGeom(null);
      dragPanelGeomRef.current = null;
      if (postDragTimerRef.current !== null) {
        window.clearTimeout(postDragTimerRef.current);
        postDragTimerRef.current = null;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (bubbleRootRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (dragDetourRafRef.current) {
        window.cancelAnimationFrame(dragDetourRafRef.current);
      }
      if (postDragTimerRef.current !== null) {
        window.clearTimeout(postDragTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setViewportSize({ width: vw, height: vh });
      setSnapKeyframes(null);
      setFrozenPanelGeom(null);
      dragPanelGeomRef.current = null;
      const edge = getEdgeMargin(vw);
      const minBottom = getMinBottom(vw);
      const maxY = Math.max(16, vh - BUBBLE_SIZE - minBottom);
      setBubblePos((prev) => {
        const next = {
          x: snapSide === 'left' ? edge : Math.max(12, vw - BUBBLE_SIZE - edge),
          y: Math.min(Math.max(prev.y, 16), maxY),
        };
        bubblePosRef.current = next;
        return next;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [snapSide]);

  const currentAuthorName = useMemo(() => {
    if (user?.displayName && user.displayName.trim()) {
      return user.displayName.trim();
    }
    if (user?.email) {
      return user.email.split('@')[0] || 'Praticien Smilo';
    }
    return 'Praticien Smilo';
  }, [user?.displayName, user?.email]);

  const currentAuthorUid = user?.uid || 'demo-practitioner';

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    getDiscussionsApi()
      .then((list) => {
        if (active) {
          setMessages(list);
          if (!hasExplicitConversationRef.current && list.length > 0) {
            const latest = list[list.length - 1];
            setActiveConversationId(latest.conversationId || 'default');
          }
          setErrorMessage(null);
        }
      })
      .catch(() => {
        // Utilisation du cache local si indisponible
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentAuthorUid]);

  const activeMessages = useMemo(
    () =>
      messages.filter(
        (item) => (item.conversationId || 'default') === activeConversationId
      ),
    [messages, activeConversationId]
  );

  const conversationSummaries = useMemo<ConversationSummary[]>(() => {
    const grouped = new Map<string, DiscussionMessage[]>();
    for (const msg of messages) {
      const convId = msg.conversationId || 'default';
      const list = grouped.get(convId);
      if (list) {
        list.push(msg);
      } else {
        grouped.set(convId, [msg]);
      }
    }
    const items: ConversationSummary[] = [];
    for (const [convId, convMsgs] of grouped.entries()) {
      const firstUser = convMsgs.find((m) => m.role === 'user');
      const lastMsg = convMsgs[convMsgs.length - 1];
      const titleSource =
        firstUser?.content && firstUser.content !== 'Image envoyée'
          ? firstUser.content
          : firstUser?.imageDataUrl
            ? 'Image partagée'
            : lastMsg?.content || 'Nouvelle conversation';
      items.push({
        id: convId,
        title: titleSource.slice(0, 60),
        updatedAt: lastMsg?.createdAt || '',
        messageCount: convMsgs.length,
      });
    }
    return items.sort(
      (a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
    );
  }, [messages]);

  useEffect(() => {
    if (!isOpen || isHistoryOpen) return;
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [activeMessages.length, isSending, isOpen, isHistoryOpen]);

  const stopDragDetourAnimation = () => {
    if (dragDetourRafRef.current) {
      window.cancelAnimationFrame(dragDetourRafRef.current);
      dragDetourRafRef.current = 0;
    }
    dragDetourWaypointsRef.current = [];
    dragDetourLastTimeRef.current = 0;
  };

  const runDragDetourStep = (timestamp: number) => {
    const waypoints = dragDetourWaypointsRef.current;
    if (waypoints.length === 0) {
      dragDetourRafRef.current = 0;
      dragDetourLastTimeRef.current = 0;
      return;
    }

    const prevTime = dragDetourLastTimeRef.current || timestamp;
    const dtSeconds = Math.min(0.05, Math.max(0.001, (timestamp - prevTime) / 1000));
    dragDetourLastTimeRef.current = timestamp;

    let remainingDist = 2000 * dtSeconds;
    let current = { ...bubblePosRef.current };

    while (waypoints.length > 0 && remainingDist > 0) {
      const target = waypoints[0];
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= remainingDist) {
        current = { x: target.x, y: target.y };
        waypoints.shift();
        remainingDist -= dist;
      } else {
        const ratio = remainingDist / dist;
        current = {
          x: current.x + dx * ratio,
          y: current.y + dy * ratio,
        };
        remainingDist = 0;
      }
    }

    bubblePosRef.current = current;
    setBubblePos(current);

    if (waypoints.length > 0) {
      dragDetourRafRef.current = window.requestAnimationFrame(runDragDetourStep);
    } else {
      dragDetourRafRef.current = 0;
      dragDetourLastTimeRef.current = 0;
    }
  };

  const handleBubblePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    suppressClickRef.current = false;
    const buttonRect = e.currentTarget.getBoundingClientRect();
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const offsetX = startClientX - buttonRect.left;
    const offsetY = startClientY - buttonRect.top;
    let moved = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startClientX;
      const dy = moveEvent.clientY - startClientY;
      if (!moved && Math.hypot(dx, dy) > 6) {
        moved = true;
        if (postDragTimerRef.current !== null) {
          window.clearTimeout(postDragTimerRef.current);
          postDragTimerRef.current = null;
        }
        isSnappingRef.current = false;
        setAnimatedBubblePos(null);
        setSnapKeyframes(null);
        setIsDragging(true);
        const currentAnchor = { x: buttonRect.left, y: buttonRect.top };
        bubblePosRef.current = currentAnchor;
        setBubblePos(currentAnchor);

        if (isOpenRef.current) {
          const geom =
            dragPanelGeomRef.current ||
            computePanelGeometry(
              currentAnchor,
              snapSideRef.current,
              window.innerWidth,
              window.innerHeight
            );
          dragPanelGeomRef.current = geom;
          setFrozenPanelGeom(geom);
        } else {
          dragPanelGeomRef.current = null;
          setFrozenPanelGeom(null);
        }
      }
      if (!moved) return;

      const dragBounds: Bounds = {
        minX: 12,
        maxX: window.innerWidth - BUBBLE_SIZE - 12,
        minY: 12,
        maxY: window.innerHeight - BUBBLE_SIZE - 12,
      };
      const desired: Point = {
        x: Math.min(Math.max(dragBounds.minX, moveEvent.clientX - offsetX), dragBounds.maxX),
        y: Math.min(Math.max(dragBounds.minY, moveEvent.clientY - offsetY), dragBounds.maxY),
      };

      const activePanel = isOpenRef.current ? dragPanelGeomRef.current : null;
      if (activePanel) {
        const obs = getObstacleRect(activePanel);
        const projected = projectOutsideObstacle(desired, obs, dragBounds);
        const path = findDetourPath(bubblePosRef.current, projected, obs, dragBounds);

        if (path.length <= 1) {
          stopDragDetourAnimation();
          const nextPoint = path[0] || projected;
          bubblePosRef.current = nextPoint;
          setBubblePos(nextPoint);
        } else {
          dragDetourWaypointsRef.current = path;
          if (!dragDetourRafRef.current) {
            dragDetourLastTimeRef.current = 0;
            dragDetourRafRef.current = window.requestAnimationFrame(runDragDetourStep);
          }
        }
      } else {
        stopDragDetourAnimation();
        bubblePosRef.current = desired;
        setBubblePos(desired);
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);

      if (!moved) {
        return;
      }

      stopDragDetourAnimation();
      suppressClickRef.current = true;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const edge = getEdgeMargin(vw);
      const minBottom = getMinBottom(vw);

      const snapBounds: Bounds = {
        minX: 12,
        maxX: vw - BUBBLE_SIZE - 12,
        minY: 16,
        maxY: vh - BUBBLE_SIZE - minBottom,
      };

      const finalX = Math.min(
        Math.max(snapBounds.minX, upEvent.clientX - offsetX),
        snapBounds.maxX
      );
      const finalY = Math.min(
        Math.max(snapBounds.minY, upEvent.clientY - offsetY),
        snapBounds.maxY
      );

      const nextSide: 'left' | 'right' =
        finalX + BUBBLE_SIZE / 2 < vw / 2 ? 'left' : 'right';
      const targetX =
        nextSide === 'left' ? edge : Math.max(12, vw - BUBBLE_SIZE - edge);
      const targetPos: Point = { x: targetX, y: finalY };
      const releasePos = bubblePosRef.current;

      const prevPanel = isOpenRef.current ? dragPanelGeomRef.current : null;
      let nextSnapKeyframes: {
        x: number[];
        y: number[];
        times: number[];
        duration: number;
      } | null = null;
      let keepFrozenDurationMs = 0;

      if (prevPanel) {
        const prevObs = getObstacleRect(prevPanel);
        const nextGeom = computePanelGeometry(targetPos, nextSide, vw, vh);
        const nextObs = getObstacleRect(nextGeom);
        const targetCollidesPrev = isInsideOpenRect(targetPos, prevObs);

        if (!targetCollidesPrev) {
          const detour = findDetourPath(releasePos, targetPos, prevObs, snapBounds);
          const crossesNextGeom = segmentIntersectsOpenRect(releasePos, targetPos, nextObs);
          if (detour.length > 1 || crossesNextGeom) {
            const kf = buildSnapKeyframes(releasePos, detour);
            if (kf) {
              nextSnapKeyframes = kf;
              keepFrozenDurationMs = Math.round(kf.duration * 1000);
            }
          }
        } else {
          const detour = findDetourPath(releasePos, targetPos, nextObs, snapBounds);
          nextSnapKeyframes = buildSnapKeyframes(releasePos, detour);
        }
      }

      if (keepFrozenDurationMs > 0 && prevPanel) {
        setFrozenPanelGeom(prevPanel);
        postDragTimerRef.current = window.setTimeout(() => {
          postDragTimerRef.current = null;
          dragPanelGeomRef.current = null;
          setFrozenPanelGeom(null);
        }, keepFrozenDurationMs);
      } else {
        dragPanelGeomRef.current = null;
        setFrozenPanelGeom(null);
      }

      isSnappingRef.current = true;
      setAnimatedBubblePos(releasePos);
      bubblePosRef.current = targetPos;
      setIsDragging(false);
      setSnapSide(nextSide);
      setSnapKeyframes(nextSnapKeyframes);
      setBubblePos(targetPos);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsProcessingImage(true);
    setErrorMessage(null);
    try {
      const prepared = await prepareDiscussionImage(file);
      setAttachedImage(prepared);
      textareaRef.current?.focus();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Impossible d'importer cette image."
      );
    } finally {
      setIsProcessingImage(false);
    }
  };

  const submitPrompt = async (rawPrompt: string) => {
    const prompt = rawPrompt.trim();
    const imageToSend = attachedImage || undefined;
    if ((!prompt && !imageToSend) || isSending || isProcessingImage) return;

    const targetConversationId = activeConversationId;
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimisticUserMessage: DiscussionMessage = {
      id: tempId,
      conversationId: targetConversationId,
      role: 'user',
      authorName: currentAuthorName,
      authorUid: currentAuthorUid,
      content: prompt || 'Image envoyée',
      ...(imageToSend ? { imageDataUrl: imageToSend } : {}),
      createdAt: new Date().toISOString(),
    };

    hasExplicitConversationRef.current = true;
    setIsHistoryOpen(false);
    setIsSending(true);
    setErrorMessage(null);
    setDraft('');
    setAttachedImage(null);
    setMessages((prev) => [...prev, optimisticUserMessage]);

    try {
      const responseData = await askAiDiscussionApi({
        conversationId: targetConversationId,
        authorName: currentAuthorName,
        authorUid: currentAuthorUid,
        prompt,
        ...(imageToSend ? { imageDataUrl: imageToSend } : {}),
      });
      if (!responseData?.userMessage || !responseData?.assistantMessage) {
        throw new Error("Réponse incomplète reçue de Diana.");
      }
      const { userMessage, assistantMessage, createdEntities, formRequest } =
        responseData;
      const storedAssistantMessage: DiscussionMessage = formRequest
        ? { ...assistantMessage, formRequest }
        : assistantMessage;
      stableKeyMapRef.current.set(userMessage.id, tempId);
      setAnimatingMessageId(storedAssistantMessage.id);
      setMessages((prev) => {
        const withoutTemp = prev.filter((item) => item.id !== tempId);
        const next = [...withoutTemp, userMessage, storedAssistantMessage];
        setCachedDiscussions(next);
        return next;
      });
      if (Array.isArray(createdEntities) && createdEntities.length > 0) {
        if (createdEntities.some((item) => item.type === 'patient')) {
          notifyPatientsUpdated();
        }
        if (createdEntities.some((item) => item.type === 'prothese')) {
          notifyProsthesesUpdated();
        }
        if (createdEntities.some((item) => item.type === 'prise_en_charge')) {
          notifyCoveragesUpdated();
        }
      }
      if (!isOpenRef.current) {
        setUnreadCount((count) => count + 1);
      }
    } catch (err) {
      setMessages((prev) => prev.filter((item) => item.id !== tempId));
      setDraft(prompt);
      if (imageToSend) {
        setAttachedImage(imageToSend);
      }
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Impossible d'obtenir une réponse de l'assistant IA."
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitPrompt(draft);
  };

  const handleNewChat = () => {
    if (isSending) return;
    const newId = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    hasExplicitConversationRef.current = true;
    setErrorMessage(null);
    setDraft('');
    setAttachedImage(null);
    setAnimatingMessageId(null);
    setIsHistoryOpen(false);
    setActiveConversationId(newId);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    hasExplicitConversationRef.current = true;
    setActiveConversationId(conversationId);
    setIsHistoryOpen(false);
    setErrorMessage(null);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (isClearing || isSending) return;
    setIsClearing(true);
    setErrorMessage(null);
    try {
      await clearDiscussionsApi(conversationId);
      const remaining = messages.filter(
        (item) => (item.conversationId || 'default') !== conversationId
      );
      setMessages(remaining);
      setCachedDiscussions(remaining);
      if (activeConversationId === conversationId) {
        const latest = remaining[remaining.length - 1];
        setActiveConversationId(
          latest?.conversationId ||
            `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        );
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Suppression impossible.'
      );
    } finally {
      setIsClearing(false);
    }
  };

  const handleInlineFormSubmitted = (messageId: string, label: string) => {
    setMessages((prev) => {
      const next = prev.map((item) =>
        item.id === messageId
          ? { ...item, formSubmittedLabel: label }
          : item
      );
      setCachedDiscussions(next);
      return next;
    });
  };

  const handleInlineFormDismiss = (messageId: string) => {
    setMessages((prev) => {
      const next = prev.map((item) =>
        item.id === messageId ? { ...item, formDismissed: true } : item
      );
      setCachedDiscussions(next);
      return next;
    });
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submitPrompt(draft);
    }
  };

  const basePanelGeom =
    frozenPanelGeom ||
    computePanelGeometry(bubblePos, snapSide, viewportSize.width, viewportSize.height);

  const liveTailPos = !isDragging && animatedBubblePos ? animatedBubblePos : bubblePos;
  const activePanelGeom: PanelGeometry =
    isDragging || animatedBubblePos || frozenPanelGeom
      ? {
          ...basePanelGeom,
          ...computeTailForPanel(basePanelGeom, liveTailPos),
        }
      : basePanelGeom;

  const {
    panelTop,
    panelLeft,
    panelWidth,
    panelHeight,
    tailPlacement,
    tailClass,
    tailStyle,
    originX,
    originY,
  } = activePanelGeom;

  const panelStyle: React.CSSProperties = {
    top: `${panelTop}px`,
    left: `${panelLeft}px`,
    width: `${panelWidth}px`,
    height: `${panelHeight}px`,
    transformOrigin: `${originX}px ${originY}px`,
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.section
            ref={panelRef}
            id="discussion-panel"
            aria-label="Discussion avec l'assistant IA"
            initial={{ opacity: 0, scale: 0.08 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.08 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={panelStyle}
            className="fixed z-[51] font-poppins bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-[0_12px_28px_rgba(0,0,0,0.12)] flex flex-col overflow-visible"
          >
            <header className="px-3.5 py-2.5 bg-[#FFFFFF] rounded-t-2xl border-0 border-b-0 flex items-center justify-between gap-2 flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full text-[#2563EB] flex items-center justify-center flex-shrink-0">
                  <BotIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[14px] font-semibold text-[#111827] truncate">
                    Diana
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  id="close-discussion-panel-btn"
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Réduire la discussion"
                  title="Réduire"
                  className="w-8 h-8 rounded-full text-[#2563EB] hover:bg-[#F3F4F6] flex items-center justify-center transition-colors cursor-pointer"
                >
                  <CloseIcon className="w-4.5 h-4.5" />
                </button>
              </div>
            </header>

            {isHistoryOpen ? (
              <DiscussionHistory
                conversations={conversationSummaries}
                activeConversationId={activeConversationId}
                isBusy={isClearing || isSending}
                onSelectConversation={handleSelectConversation}
                onDeleteConversation={(convId) => {
                  void handleDeleteConversation(convId);
                }}
                onCreateNewChat={handleNewChat}
              />
            ) : (
              <div
                ref={scrollContainerRef}
                className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-3.5 py-2 space-y-1.5 bg-[#FFFFFF]"
              >
                {isLoading && activeMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-[#374151]">
                    Chargement...
                  </div>
                ) : (
                  activeMessages.map((msg, index) => {
                    const prevMsg = activeMessages[index - 1];
                    const nextMsg = activeMessages[index + 1];
                    const isUser = msg.role === 'user';
                    const isSameAsPrev = prevMsg && prevMsg.role === msg.role;
                    const isSameAsNext = nextMsg && nextMsg.role === msg.role;
                    const showTime = shouldShowTimestampSeparator(msg, prevMsg);
                    const hasSafeImage = isSafeImageDataUrl(msg.imageDataUrl);
                    const showTextContent =
                      !isUser || !hasSafeImage || msg.content !== 'Image envoyée';

                    const bubbleRadius = isUser
                      ? isSameAsPrev && isSameAsNext
                        ? 'rounded-[18px] rounded-r-[4px]'
                        : isSameAsPrev
                          ? 'rounded-[18px] rounded-tr-[4px]'
                          : isSameAsNext
                            ? 'rounded-[18px] rounded-br-[4px]'
                            : 'rounded-[18px]'
                      : isSameAsPrev && isSameAsNext
                        ? 'rounded-[18px] rounded-l-[4px]'
                        : isSameAsPrev
                          ? 'rounded-[18px] rounded-tl-[4px]'
                          : isSameAsNext
                            ? 'rounded-[18px] rounded-bl-[4px]'
                            : 'rounded-[18px]';

                    const messageKey = stableKeyMapRef.current.get(msg.id) || msg.id;
                    const showInlineForm =
                      !isUser && Boolean(msg.formRequest) && !msg.formDismissed;

                    return (
                      <React.Fragment key={messageKey}>
                        {showTime && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className="py-1.5 text-center text-[10px] font-medium text-[#374151]"
                          >
                            {formatMessageTime(msg.createdAt)}
                          </motion.div>
                        )}

                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                          style={{ transformOrigin: isUser ? 'bottom right' : 'bottom left' }}
                          className={`flex items-end gap-2 ${
                            isUser ? 'justify-end' : 'justify-start'
                          } ${!isSameAsPrev && !showTime ? 'pt-2' : ''}`}
                        >
                          {!isUser && (
                            <div className="w-7 h-7 flex-shrink-0 flex items-end justify-center">
                              {!isSameAsNext && (
                                <span className="w-7 h-7 rounded-full bg-[#2563EB] text-[#FFFFFF] inline-flex items-center justify-center">
                                  <BotIcon className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                          )}

                          <div
                            title={formatMessageTime(msg.createdAt)}
                            className={`${
                              showInlineForm ? 'w-full max-w-[90%]' : 'max-w-[78%]'
                            } px-3.5 py-2 text-[13px] leading-[1.4] break-words whitespace-pre-wrap ${bubbleRadius} ${
                              isUser
                                ? 'bg-[#2563EB] text-[#FFFFFF]'
                                : 'bg-[#F3F4F6] text-[#111827]'
                            }`}
                          >
                            {hasSafeImage && msg.imageDataUrl && (
                              <img
                                src={msg.imageDataUrl}
                                alt="Image partagée"
                                className={`max-h-44 w-full rounded-xl object-cover ${
                                  showTextContent ? 'mb-1.5' : ''
                                }`}
                              />
                            )}
                            {showTextContent &&
                              (!isUser ? (
                                <AssistantMessageText
                                  content={msg.content}
                                  animate={animatingMessageId === msg.id}
                                  onProgress={() => {
                                    const container = scrollContainerRef.current;
                                    if (container) {
                                      container.scrollTop = container.scrollHeight;
                                    }
                                  }}
                                  onComplete={() => {
                                    setAnimatingMessageId((curr) =>
                                      curr === msg.id ? null : curr
                                    );
                                  }}
                                />
                              ) : (
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ duration: 0.22, delay: 0.04 }}
                                >
                                  {msg.content}
                                </motion.div>
                              ))}

                            {showInlineForm && msg.formRequest && (
                              <div className="whitespace-normal">
                                <DiscussionActionForm
                                  formRequest={msg.formRequest}
                                  submittedLabel={msg.formSubmittedLabel}
                                  onSubmitted={(label) =>
                                    handleInlineFormSubmitted(msg.id, label)
                                  }
                                  onDismiss={() => handleInlineFormDismiss(msg.id)}
                                />
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </React.Fragment>
                    );
                  })
                )}

                {isSending && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-end gap-2 justify-start pt-2"
                  >
                    <span className="w-7 h-7 rounded-full bg-[#2563EB] text-[#FFFFFF] inline-flex items-center justify-center flex-shrink-0">
                      <BotIcon className="w-3.5 h-3.5" />
                    </span>
                    <div className="rounded-[18px] px-3.5 py-2.5 bg-[#F3F4F6] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#374151] animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#374151] animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#374151] animate-bounce [animation-delay:300ms]" />
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {errorMessage && (
              <div className="px-3.5 py-2 bg-[#FEF2F2] text-[11px] text-[#DC2626] flex items-start justify-between gap-2">
                <span className="break-words">{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-[#DC2626] font-medium hover:underline flex-shrink-0 cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            )}

            <form
              onSubmit={handleFormSubmit}
              className="px-3 py-2 bg-[#FFFFFF] rounded-b-2xl border-0 border-t-0 flex-shrink-0"
            >
              <div className="flex items-end gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageSelected}
                  className="hidden"
                />
                <motion.div
                  initial={false}
                  animate={{ width: isComposerExpanded ? 28 : 88 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="relative h-[34px] flex-shrink-0 overflow-hidden"
                >
                  <motion.div
                    initial={false}
                    animate={{
                      opacity: isComposerExpanded ? 0 : 1,
                      scale: isComposerExpanded ? 0.78 : 1,
                      x: isComposerExpanded ? -10 : 0,
                    }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    aria-hidden={isComposerExpanded}
                    className={`absolute inset-y-0 left-0 flex items-center gap-0.5 ${
                      isComposerExpanded ? 'pointer-events-none' : ''
                    }`}
                  >
                    <button
                      id="discussion-image-btn"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSending || isProcessingImage}
                      tabIndex={isComposerExpanded ? -1 : 0}
                      aria-label="Importer une image"
                      title="Importer une image"
                      className="w-7 h-7 rounded-full text-[#2563EB] hover:bg-[#F3F4F6] disabled:opacity-50 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ImagePlusIcon className="w-4 h-4" />
                    </button>
                    <button
                      id="history-discussion-btn"
                      type="button"
                      onClick={() => setIsHistoryOpen((prev) => !prev)}
                      disabled={isSending}
                      tabIndex={isComposerExpanded ? -1 : 0}
                      aria-label="Historique de conversation"
                      title="Historique de conversation"
                      aria-pressed={isHistoryOpen}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 ${
                        isHistoryOpen
                          ? 'bg-[#EFF6FF] text-[#2563EB]'
                          : 'text-[#2563EB] hover:bg-[#F3F4F6]'
                      }`}
                    >
                      <HistoryIcon className="w-4 h-4" />
                    </button>
                    <button
                      id="new-chat-btn"
                      type="button"
                      onClick={handleNewChat}
                      disabled={isSending}
                      tabIndex={isComposerExpanded ? -1 : 0}
                      aria-label="Nouveau chat"
                      title="Nouveau chat"
                      className="w-7 h-7 rounded-full text-[#2563EB] hover:bg-[#F3F4F6] disabled:opacity-50 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </motion.div>

                  <div
                    className={`absolute inset-y-0 left-0 flex items-center ${
                      isComposerExpanded ? '' : 'pointer-events-none'
                    }`}
                  >
                    <motion.button
                      id="collapse-composer-btn"
                      type="button"
                      onClick={() => {
                        setIsComposerExpanded(false);
                        textareaRef.current?.blur();
                      }}
                      initial={false}
                      animate={{
                        opacity: isComposerExpanded ? 1 : 0,
                        scale: isComposerExpanded ? 1 : 0.72,
                      }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                      tabIndex={isComposerExpanded ? 0 : -1}
                      aria-label="Afficher les icônes"
                      title="Afficher les icônes"
                      className="w-7 h-7 rounded-full text-[#2563EB] hover:bg-[#F3F4F6] flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ChevronRightIcon className="w-4 h-4" />
                    </motion.button>
                  </div>
                </motion.div>

                <div
                  onClick={() => {
                    setIsComposerExpanded(true);
                    textareaRef.current?.focus();
                  }}
                  className="flex-1 min-w-0 flex flex-col justify-end rounded-[20px] bg-[#F3F4F6] pl-3.5 pr-1 py-1 cursor-text"
                >
                  {attachedImage && isSafeImageDataUrl(attachedImage) && (
                    <div className="pt-1.5 pb-1 pr-2 flex items-center">
                      <div className="relative inline-block">
                        <img
                          src={attachedImage}
                          alt="Aperçu"
                          className="w-12 h-12 rounded-xl object-cover border border-[#E5E7EB]"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAttachedImage(null);
                          }}
                          aria-label="Retirer l'image"
                          title="Retirer l'image"
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#FFFFFF] text-[#374151] border border-[#E5E7EB] hover:bg-[#F3F4F6] flex items-center justify-center cursor-pointer shadow-sm"
                        >
                          <CloseIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 w-full min-w-0">
                    <textarea
                      ref={textareaRef}
                      id="discussion-message-input"
                      rows={1}
                      maxLength={2000}
                      value={draft}
                      onFocus={() => setIsComposerExpanded(true)}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        setIsComposerExpanded(true);
                      }}
                      onKeyDown={handleComposerKeyDown}
                      placeholder="Écrire un message..."
                      className="flex-1 min-w-0 h-[26px] resize-none py-1 bg-transparent border-0 text-[13px] leading-[1.35] whitespace-nowrap overflow-x-auto overflow-y-hidden no-scrollbar text-[#111827] placeholder:text-[#374151] focus:outline-none"
                    />
                    <button
                      id="discussion-send-btn"
                      type="submit"
                      disabled={(!draft.trim() && !attachedImage) || isSending || isProcessingImage}
                      aria-label="Envoyer"
                      className="w-7 h-7 rounded-full bg-transparent text-[#2563EB] hover:text-[#1D4ED8] disabled:text-[#9CA3AF] disabled:cursor-default inline-flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                    >
                      <SendIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {tailPlacement !== 'none' && (
              <span
                aria-hidden="true"
                style={tailStyle}
                className={`pointer-events-none absolute w-3.5 h-3.5 rotate-45 bg-[#FFFFFF] border-[#E5E7EB] ${tailClass}`}
              />
            )}
          </motion.section>
        )}
      </AnimatePresence>

      <motion.div
        ref={bubbleRootRef}
        id="discussion-bubble-root"
        initial={false}
        animate={
          snapKeyframes
            ? { x: snapKeyframes.x, y: snapKeyframes.y }
            : { x: bubblePos.x, y: bubblePos.y }
        }
        transition={
          isDragging
            ? { duration: 0 }
            : snapKeyframes
              ? {
                  type: 'tween',
                  duration: snapKeyframes.duration,
                  times: snapKeyframes.times,
                  ease: snapKeyframes.x.length > 2 ? 'linear' : [0.22, 1, 0.36, 1],
                }
              : { type: 'tween', duration: 0.55, ease: [0.22, 1, 0.36, 1] }
        }
        onUpdate={(latest) => {
          if (!isOpenRef.current || !isSnappingRef.current) return;
          const x = typeof latest.x === 'number' ? latest.x : Number(latest.x);
          const y = typeof latest.y === 'number' ? latest.y : Number(latest.y);
          if (Number.isFinite(x) && Number.isFinite(y)) {
            setAnimatedBubblePos((prev) => {
              if (prev && Math.abs(prev.x - x) < 0.25 && Math.abs(prev.y - y) < 0.25) {
                return prev;
              }
              return { x, y };
            });
          }
        }}
        onAnimationComplete={() => {
          if (isSnappingRef.current) {
            isSnappingRef.current = false;
            setAnimatedBubblePos(null);
          }
        }}
        className="fixed top-0 left-0 z-50 font-poppins select-none touch-none"
      >
        <button
          id="discussion-bubble-toggle"
          type="button"
          onPointerDown={handleBubblePointerDown}
          onClick={() => {
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }
            setIsOpen((prev) => !prev);
          }}
          aria-label={isOpen ? "Fermer la bulle de discussion" : "Ouvrir la bulle de discussion"}
          aria-expanded={isOpen}
          className="relative w-14 h-14 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] shadow-lg ring-2 ring-[#FFFFFF] flex items-center justify-center transition-colors cursor-grab active:cursor-grabbing active:scale-95"
        >
          <BotIcon className="w-6 h-6" />

          {!isOpen && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#DC2626] text-[#FFFFFF] text-[10px] font-semibold flex items-center justify-center ring-2 ring-[#FFFFFF]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </motion.div>
    </>
  );
};
