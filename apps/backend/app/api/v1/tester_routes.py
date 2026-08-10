from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from app.api.tester_documentation import TESTER_API_DOCUMENTATION

router = APIRouter(prefix="/tester", tags=["tester"])


@router.get(
    "/documentation",
    response_class=PlainTextResponse,
    summary="Download Tester API documentation",
)
async def download_tester_documentation() -> PlainTextResponse:
    return PlainTextResponse(
        TESTER_API_DOCUMENTATION,
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": (
                'attachment; filename="montecarlo-tester-api.md"'
            )
        },
    )
