from cthuvian_translator import Translator
from cthuvian_translator.reverse import ReverseGloss
from cthuvian_translator.sealing import seal_text, unseal_text


def test_negative_knowledge_sentence_low_register():
    result = Translator().translate("I do not know everything.")
    assert result.cthuvian == "Ya-yr na kadishtu nilgh'ri-ef"
    assert result.ir is not None
    assert result.ir.predicate == "KNOW"
    assert result.ir.polarity == "negative"
    assert result.roundtrip_ok


def test_negative_knowledge_sentence_high_register():
    result = Translator().translate("I do not know everything.", register="high")
    assert result.cthuvian == "Ya na kadishtu nilgh'ri"


def test_past_written_book_about_hidden_city():
    result = Translator().translate("The scholar wrote a book about the hidden city.")
    assert result.cthuvian == "kadishtu-nyth-yr nafl'athg eeh-ftaghu-ef l'r'luh wgah'nagl-ri"


def test_machine_transforms_body_into_gate():
    result = Translator().translate("The machine transforms the body into a gate.")
    assert result.cthuvian == "fmagl-yr wk'hmr bthnk-ef nglui-ep"


def test_registry_term_is_stable():
    result = Translator().translate("The scientist used a microscope.")
    assert "vren-yll-fmagl-ef" in result.cthuvian


def test_sealed_text_is_reversible():
    sealed = seal_text("x^2 + 3x")
    assert unseal_text(sealed) == "x^2 + 3x"


def test_reverse_gloss_lovecraft_sentence_fragments():
    gloss = ReverseGloss().gloss("ph'nglui mglw'nafh Cthulhu R'lyeh wgah'nagl fhtagn")
    assert "dead; beyond the threshold" in gloss.best_gloss
    assert "waits, dreams, lies dormant" in gloss.best_gloss
